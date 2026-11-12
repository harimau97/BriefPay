import { lookup } from "dns/promises";
import { isIP } from "net";
import * as cheerio from "cheerio";
import { appBaseUrl } from "@/lib/format";

export type PageObservation = {
  mode: "kernel" | "fetch";
  url: string;
  finalUrl: string;
  title: string;
  text: string;
  headings: string[];
  buttons: string[];
  links: string[];
  planCount: number;
  planNames: string[];
  hasContactForm: boolean;
  contactFields: string[];
  heroText: string;
  ctaTexts: string[];
  ctaVisibleOnMobile: boolean | null;
  mobileNote: string;
  liveViewUrl?: string;
};

export function resolveDeliveryUrl(input: string) {
  const trimmed = input.trim();
  if (trimmed.startsWith("/")) return new URL(trimmed, `${appBaseUrl()}/`);
  return new URL(trimmed);
}

function isBlockedAddress(address: string) {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  const mapped = address.startsWith("::ffff:") ? address.slice(7) : address;
  const parts = mapped.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    const lower = address.toLowerCase();
    return lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80");
  }
  const [a, b] = parts;
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

export async function assertBrowseable(url: URL) {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses can be opened.");
  }
  const appHost = new URL(appBaseUrl()).hostname;
  if (url.hostname === appHost || url.hostname === "localhost") return;
  const addresses = isIP(url.hostname) ? [url.hostname] : (await lookup(url.hostname, { all: true })).map((item) => item.address);
  if (addresses.some((address) => isBlockedAddress(address))) {
    throw new Error("Internal network addresses cannot be opened.");
  }
}

export function observeHtml(html: string, url: string, mode: PageObservation["mode"]): PageObservation {
  const $ = cheerio.load(html);
  $("[data-briefpay-chrome]").remove();
  const scoped = $("[data-delivery]");
  const scope = scoped.length ? scoped : $("body");
  const textOf = (value: string) => value.replace(/\s+/g, " ").trim();
  const headings = scope
    .find("h1, h2, h3")
    .map((_, element) => textOf($(element).text()))
    .get()
    .filter(Boolean);
  const ctaTexts = scope
    .find("[data-cta]")
    .map((_, element) => textOf($(element).text()))
    .get()
    .filter(Boolean);
  const buttons = scope
    .find("button, [role='button']")
    .map((_, element) => textOf($(element).text()))
    .get()
    .filter(Boolean);
  const planNames = scope
    .find("[data-plan]")
    .map((_, element) => textOf($(element).text()).slice(0, 80))
    .get()
    .filter(Boolean);
  const form = scope.find("form[data-contact]").first();
  const contactForm = form.length ? form : scope.find("form").first();
  const contactFields = contactForm
    .find("input, textarea, select")
    .map((_, element) => $(element).attr("name") || $(element).attr("aria-label") || $(element).attr("type") || "field")
    .get();
  const hero = scope.find("[data-hero]").first();
  const desktopOnly = scope.find("[data-cta][data-desktop-only], [data-cta].desktop-only").length > 0;
  const hiddenCta = scope.find("[data-cta][hidden], [data-cta][aria-hidden='true']").length > 0;
  let ctaVisibleOnMobile: boolean | null = null;
  let mobileNote = "Only the static HTML was checked. A real viewport measurement runs when Kernel is available.";
  if (ctaTexts.length === 0) {
    ctaVisibleOnMobile = false;
    mobileNote = "No call-to-action element is in the document.";
  } else if (desktopOnly || hiddenCta) {
    ctaVisibleOnMobile = false;
    mobileNote = "The call-to-action is marked desktop-only.";
  } else if (mode === "fetch") {
    ctaVisibleOnMobile = true;
    mobileNote = `Call-to-action "${ctaTexts[0]}" is in the document without a hidden attribute. This is a static check.`;
  }

  return {
    mode,
    url,
    finalUrl: url,
    title: textOf($("title").text()),
    text: textOf(scope.text()).slice(0, 8000),
    headings,
    buttons,
    links: scope
      .find("a")
      .map((_, element) => textOf($(element).text()))
      .get()
      .filter(Boolean)
      .slice(0, 20),
    planCount: planNames.length,
    planNames,
    hasContactForm: contactForm.length > 0 && contactFields.length > 0,
    contactFields,
    heroText: textOf(hero.text()).slice(0, 500),
    ctaTexts: ctaTexts.length ? ctaTexts : buttons.slice(0, 4),
    ctaVisibleOnMobile,
    mobileNote,
  };
}

const kernelScript = (url: string) => `
const target = ${JSON.stringify(url)};
await page.goto(target, { waitUntil: "domcontentloaded", timeout: 45000 });
async function snapshot() {
  return await page.evaluate(() => {
    document.querySelector("[data-briefpay-chrome]")?.remove();
    const root = document.querySelector("[data-delivery]") || document.body;
    const clean = (value) => (value || "").replace(/\\s+/g, " ").trim();
    const textOf = (el) => clean(el?.innerText || "");
    const headings = [...root.querySelectorAll("h1,h2,h3")].map(textOf).filter(Boolean);
    const ctaEls = [...root.querySelectorAll("[data-cta]")];
    const ctaTexts = ctaEls.map(textOf).filter(Boolean);
    const buttons = [...root.querySelectorAll("button,[role=button]")].map(textOf).filter(Boolean);
    const planNames = [...root.querySelectorAll("[data-plan]")].map((el) => textOf(el).slice(0, 80)).filter(Boolean);
    const form = root.querySelector("form[data-contact]") || root.querySelector("form");
    const contactFields = form ? [...form.querySelectorAll("input,textarea,select")].map((el) => el.getAttribute("name") || el.getAttribute("type") || "field") : [];
    const visible = (el) => {
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 8 && rect.height > 8;
    };
    return {
      title: document.title,
      headings,
      heroText: textOf(root.querySelector("[data-hero]") || root.querySelector("h1")).slice(0, 500),
      buttons,
      ctaTexts,
      ctaVisible: ctaEls.some(visible),
      planNames,
      planCount: planNames.length,
      hasContactForm: Boolean(form) && contactFields.length > 0,
      contactFields,
      links: [...root.querySelectorAll("a")].map((el) => clean(el.textContent)).filter(Boolean).slice(0, 20),
      text: textOf(root).slice(0, 8000),
    };
  });
}
await page.setViewportSize({ width: 1280, height: 900 });
const desktop = await snapshot();
await page.setViewportSize({ width: 390, height: 844 });
await new Promise((resolve) => setTimeout(resolve, 300));
const mobile = await snapshot();
return { desktop, mobileCtaVisible: mobile.ctaVisible, finalUrl: page.url() };
`;

async function browseWithKernel(url: string): Promise<PageObservation> {
  const { default: Kernel } = await import("@onkernel/sdk");
  const kernel = new Kernel({ apiKey: process.env.KERNEL_API_KEY });
  const browser = await kernel.browsers.create({ headless: false, timeout_seconds: 180 });
  try {
    const response = await kernel.browsers.playwright.execute(browser.session_id, {
      code: kernelScript(url),
      timeout_sec: 70,
    });
    if (!response.success) {
      throw new Error(response.error || "Kernel Playwright failed to run.");
    }
    const result = response.result as {
      desktop: Omit<PageObservation, "mode" | "url" | "finalUrl" | "ctaVisibleOnMobile" | "mobileNote" | "liveViewUrl">;
      mobileCtaVisible: boolean;
      finalUrl: string;
    };
    const desktop = result.desktop;
    return {
      mode: "kernel",
      url,
      finalUrl: result.finalUrl || url,
      title: desktop.title,
      text: desktop.text,
      headings: desktop.headings,
      buttons: desktop.buttons,
      links: desktop.links,
      planCount: desktop.planCount,
      planNames: desktop.planNames,
      hasContactForm: desktop.hasContactForm,
      contactFields: desktop.contactFields,
      heroText: desktop.heroText,
      ctaTexts: desktop.ctaTexts,
      ctaVisibleOnMobile: result.mobileCtaVisible,
      mobileNote: result.mobileCtaVisible
        ? "The call-to-action box was measured at a 390px width."
        : "The call-to-action was not visible at a 390px width.",
      liveViewUrl: browser.browser_live_view_url,
    };
  } finally {
    await kernel.browsers.deleteByID(browser.session_id).catch(() => undefined);
  }
}

async function browseWithFetch(url: string): Promise<PageObservation> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "BriefPayVerifier/1.0" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`Could not open the page (${response.status}).`);
  }
  const html = await response.text();
  const observation = observeHtml(html, url, "fetch");
  observation.finalUrl = response.url || url;
  return observation;
}

export async function browseDelivery(rawUrl: string, onLog?: (message: string) => void): Promise<PageObservation> {
  const url = resolveDeliveryUrl(rawUrl);
  await assertBrowseable(url);
  const href = url.toString();
  if (process.env.KERNEL_API_KEY) {
    onLog?.("Opening the page in a Kernel browser.");
    try {
      const observation = await browseWithKernel(href);
      onLog?.("Read the page at desktop width and at a 390px mobile width.");
      return observation;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kernel error";
      onLog?.(`Kernel was unavailable, so the page HTML was read directly. ${message}`);
    }
  } else {
    onLog?.("KERNEL_API_KEY is not set, so the page HTML is read directly.");
  }
  return browseWithFetch(href);
}
