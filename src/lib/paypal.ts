import { centsToPayPal } from "@/lib/format";

const SANDBOX = "https://api-m.sandbox.paypal.com";

export class PayPalError extends Error {
  constructor(
    message: string,
    readonly detail?: unknown,
  ) {
    super(message);
    this.name = "PayPalError";
  }
}

export function paypalConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

export function paypalMockEnabled() {
  return process.env.PAYPAL_MOCK === "true" && !process.env.PAYPAL_CLIENT_ID;
}

function assertSandbox() {
  if (process.env.PAYPAL_ENVIRONMENT === "LIVE") {
    throw new PayPalError("This project uses the PayPal sandbox only.");
  }
}

let tokenCache: { value: string; expiresAt: number } | null = null;

export async function getAccessToken() {
  assertSandbox();
  if (!paypalConfigured()) {
    throw new PayPalError("PayPal sandbox client id and secret are missing.");
  }
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }
  const id = process.env.PAYPAL_CLIENT_ID as string;
  const secret = process.env.PAYPAL_CLIENT_SECRET as string;
  const response = await fetch(`${SANDBOX}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20_000),
  });
  const data = await readJson(response);
  if (!response.ok || typeof data.access_token !== "string") {
    throw new PayPalError(paypalMessage(data, "Did not receive an access token."), data);
  }
  const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 300;
  tokenCache = { value: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  return data.access_token;
}

async function paypalFetch(path: string, init: { method: string; body?: string; requestId?: string; prefer?: string }) {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
  if (init.prefer) headers.Prefer = init.prefer;
  const response = await fetch(`${SANDBOX}${path}`, {
    method: init.method,
    headers,
    body: init.body,
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 204) return {};
  const data = await readJson(response);
  if (!response.ok) {
    throw new PayPalError(paypalMessage(data, `PayPal request failed (${response.status}).`), data);
  }
  return data;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { message: text };
  }
}

function paypalMessage(data: Record<string, unknown>, fallback: string) {
  const message = typeof data.message === "string" ? data.message : fallback;
  const details = Array.isArray(data.details)
    ? data.details
        .map((item) => {
          if (!item || typeof item !== "object") return "";
          const record = item as Record<string, unknown>;
          return String(record.description || record.issue || "");
        })
        .filter(Boolean)
        .join(" ")
    : "";
  return details ? `${message}: ${details}` : message;
}

export type PayPalAmount = { currency_code?: string; value?: string };

export type PayPalOrder = {
  id?: string;
  status?: string;
  purchase_units?: Array<{
    custom_id?: string;
    reference_id?: string;
    amount?: PayPalAmount;
    payments?: {
      authorizations?: Array<{ id: string; status: string; amount?: PayPalAmount }>;
      captures?: Array<{ id: string; status: string; amount?: PayPalAmount }>;
    };
  }>;
};

export function amountsMatch(value: string | undefined, cents: number) {
  if (!value) return false;
  return Number(value).toFixed(2) === centsToPayPal(cents);
}

export async function createAuthorizeOrder(input: {
  jobId: string;
  title: string;
  cents: number;
  currency: string;
}) {
  if (paypalMockEnabled()) {
    return { id: `MOCK-ORDER-${input.jobId}`, status: "CREATED", mock: true };
  }
  const value = centsToPayPal(input.cents);
  const data = await paypalFetch("/v2/checkout/orders", {
    method: "POST",
    requestId: `briefpay-order-${input.jobId}-${crypto.randomUUID()}`,
    body: JSON.stringify({
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: input.jobId.slice(0, 256),
          custom_id: input.jobId.slice(0, 127),
          description: `BriefPay authorization hold: ${input.title}`.slice(0, 127),
          amount: { currency_code: input.currency, value },
        },
      ],
      application_context: {
        brand_name: "BriefPay",
        shipping_preference: "NO_SHIPPING",
        user_action: "PAY_NOW",
      },
    }),
  });
  return data as PayPalOrder & { mock?: boolean };
}

export async function getOrder(orderId: string) {
  return (await paypalFetch(`/v2/checkout/orders/${orderId}`, { method: "GET" })) as PayPalOrder;
}

export async function authorizeOrder(orderId: string, jobId: string) {
  if (paypalMockEnabled() || orderId.startsWith("MOCK-ORDER-")) {
    return {
      id: orderId,
      status: "COMPLETED",
      purchase_units: [
        {
          custom_id: jobId,
          payments: {
            authorizations: [{ id: `MOCK-AUTH-${jobId}`, status: "CREATED" }],
          },
        },
      ],
    } as PayPalOrder;
  }
  const authorized = (await paypalFetch(`/v2/checkout/orders/${orderId}/authorize`, {
    method: "POST",
    requestId: `briefpay-auth-${orderId}`,
    prefer: "return=representation",
    body: "{}",
  })) as PayPalOrder;
  const parsed = readAuthorization(authorized);
  if (parsed.authorization?.amount?.value && parsed.unit?.custom_id) {
    return authorized;
  }
  try {
    const full = await getOrder(authorized.id || orderId);
    return { ...full, id: full.id || authorized.id || orderId, status: full.status || authorized.status };
  } catch {
    return authorized;
  }
}

export function readAuthorization(order: PayPalOrder) {
  const unit = order.purchase_units?.[0];
  const authorization = unit?.payments?.authorizations?.[0];
  const capture = unit?.payments?.captures?.[0];
  return { unit, authorization, capture };
}

export async function getAuthorization(authorizationId: string) {
  return paypalFetch(`/v2/payments/authorizations/${authorizationId}`, { method: "GET" }) as Promise<{
    id?: string;
    status?: string;
    amount?: PayPalAmount;
  }>;
}

export async function captureAuthorization(input: {
  authorizationId: string;
  jobId: string;
  cents: number;
  currency: string;
}) {
  if (paypalMockEnabled() || input.authorizationId.startsWith("MOCK-AUTH-")) {
    return { id: `MOCK-CAPTURE-${input.jobId}`, status: "COMPLETED", mock: true };
  }
  return paypalFetch(`/v2/payments/authorizations/${input.authorizationId}/capture`, {
    method: "POST",
    requestId: `briefpay-capture-${input.jobId}`,
    body: JSON.stringify({
      amount: { currency_code: input.currency, value: centsToPayPal(input.cents) },
      final_capture: true,
    }),
  }) as Promise<{ id?: string; status?: string }>;
}

export async function voidAuthorization(authorizationId: string, jobId: string) {
  if (paypalMockEnabled() || authorizationId.startsWith("MOCK-AUTH-")) {
    return { mock: true };
  }
  return paypalFetch(`/v2/payments/authorizations/${authorizationId}/void`, {
    method: "POST",
    requestId: `briefpay-void-${jobId}`,
  });
}

export async function refundCapture(captureId: string, jobId: string, cents: number, currency: string) {
  if (paypalMockEnabled() || captureId.startsWith("MOCK-CAPTURE-")) {
    return { id: `MOCK-REFUND-${jobId}`, status: "COMPLETED", mock: true };
  }
  return paypalFetch(`/v2/payments/captures/${captureId}/refund`, {
    method: "POST",
    requestId: `briefpay-refund-${jobId}`,
    body: JSON.stringify({
      amount: { currency_code: currency, value: centsToPayPal(cents) },
    }),
  });
}

export async function createReceiptInvoice(input: {
  jobId: string;
  title: string;
  cents: number;
  currency: string;
  captureId: string;
  recipientEmail: string;
}) {
  if (paypalMockEnabled()) {
    return { id: `MOCK-INVOICE-${input.jobId}`, status: "PAID", mock: true };
  }
  const value = centsToPayPal(input.cents);
  const invoicer = process.env.PAYPAL_MERCHANT_EMAIL
    ? { invoicer: { email_address: process.env.PAYPAL_MERCHANT_EMAIL } }
    : {};
  const created = await paypalFetch("/v2/invoicing/invoices", {
    method: "POST",
    requestId: `briefpay-invoice-${input.jobId}`,
    body: JSON.stringify({
      detail: {
        currency_code: input.currency,
        reference: input.jobId.slice(0, 120),
        note: "BriefPay receipt. This records a payment that was already captured. It does not request another payment.",
        memo: `Already captured. PayPal capture ${input.captureId}. Do not pay again.`,
        terms_and_conditions:
          "This invoice is a receipt for a PayPal authorization that BriefPay already captured after the delivery passed review.",
        payment_term: { term_type: "DUE_ON_RECEIPT" },
      },
      ...invoicer,
      primary_recipients: [{ billing_info: { email_address: input.recipientEmail } }],
      items: [
        {
          name: input.title.slice(0, 200),
          description: "Verified delivery. Payment already captured.",
          quantity: "1",
          unit_amount: { currency_code: input.currency, value },
        },
      ],
    }),
  });
  const invoiceId = invoiceIdFrom(created);
  if (!invoiceId) {
    throw new PayPalError("Could not find an invoice id in the response.", created);
  }
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/send`, {
    method: "POST",
    requestId: `briefpay-invoice-send-${input.jobId}`,
    body: JSON.stringify({
      send_to_invoicer: false,
      note: "Receipt for a job that was already paid. You do not need to pay again.",
    }),
  });
  await paypalFetch(`/v2/invoicing/invoices/${invoiceId}/payments`, {
    method: "POST",
    requestId: `briefpay-invoice-payment-${input.jobId}`,
    body: JSON.stringify({
      method: "PAYPAL",
      payment_date: new Date().toISOString().slice(0, 10),
      amount: { currency_code: input.currency, value },
      note: `Recorded against capture ${input.captureId}. Not an additional charge.`,
    }),
  });
  return { id: invoiceId, status: "PAID" };
}

export async function finalizeInvoiceReceipt(input: {
  invoiceId: string;
  jobId: string;
  captureId: string;
  cents: number;
  currency: string;
}) {
  const value = centsToPayPal(input.cents);
  await paypalFetch(`/v2/invoicing/invoices/${input.invoiceId}/send`, {
    method: "POST",
    requestId: `briefpay-invoice-send-${input.jobId}`,
    body: JSON.stringify({
      send_to_invoicer: false,
      note: "Receipt for a job that was already paid. You do not need to pay again.",
    }),
  });
  await paypalFetch(`/v2/invoicing/invoices/${input.invoiceId}/payments`, {
    method: "POST",
    requestId: `briefpay-invoice-payment-${input.jobId}`,
    body: JSON.stringify({
      method: "PAYPAL",
      payment_date: new Date().toISOString().slice(0, 10),
      amount: { currency_code: input.currency, value },
      note: `Recorded against capture ${input.captureId}. Not an additional charge.`,
    }),
  });
}

export async function getInvoice(invoiceId: string) {
  return paypalFetch(`/v2/invoicing/invoices/${invoiceId}`, { method: "GET" });
}

export function invoiceIdFrom(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/INV2-[A-Z0-9-]+/i);
    return match ? match[0] : null;
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string" && record.id.startsWith("INV")) return record.id;
    if (typeof record.href === "string") {
      const fromHref = invoiceIdFrom(record.href);
      if (fromHref) return fromHref;
    }
    for (const child of Object.values(record)) {
      const found = invoiceIdFrom(child);
      if (found) return found;
    }
  }
  return null;
}

export function invoiceAmountMatches(invoice: Record<string, unknown>, cents: number) {
  const amount = invoice.amount as { value?: string } | undefined;
  if (amount?.value && amountsMatch(amount.value, cents)) return true;
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const sum = items.reduce((total, item) => {
    if (!item || typeof item !== "object") return total;
    const unit = (item as { unit_amount?: { value?: string }; quantity?: string }).unit_amount?.value;
    const quantity = Number((item as { quantity?: string }).quantity || "1");
    return total + (unit ? Number(unit) * quantity : 0);
  }, 0);
  return sum > 0 && sum.toFixed(2) === centsToPayPal(cents);
}
