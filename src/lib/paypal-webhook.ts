import { getAccessToken } from "@/lib/paypal";

const SANDBOX = "https://api-m.sandbox.paypal.com";

export async function verifyWebhookSignature(input: {
  headers: Headers;
  event: unknown;
}) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    throw new Error("PAYPAL_WEBHOOK_ID is missing.");
  }
  const transmissionId = input.headers.get("paypal-transmission-id");
  const transmissionTime = input.headers.get("paypal-transmission-time");
  const transmissionSig = input.headers.get("paypal-transmission-sig");
  const certUrl = input.headers.get("paypal-cert-url");
  const authAlgo = input.headers.get("paypal-auth-algo");
  if (!transmissionId || !transmissionTime || !transmissionSig || !certUrl || !authAlgo) {
    throw new Error("PayPal webhook signature headers are missing.");
  }
  const cert = new URL(certUrl);
  if (cert.protocol !== "https:" || !cert.hostname.endsWith("paypal.com")) {
    throw new Error("The certificate URL is not a PayPal certificate URL.");
  }
  const token = await getAccessToken();
  const response = await fetch(`${SANDBOX}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: input.event,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await response.json()) as { verification_status?: string };
  if (!response.ok || data.verification_status !== "SUCCESS") {
    throw new Error("Webhook signature verification failed.");
  }
}
