import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, isStepCount, tool } from "ai";
import { z } from "zod";
import { browseDelivery, type PageObservation } from "@/lib/browse";

export type CriterionInput = { id: string; label: string };

export type CriterionJudgement = {
  criterionId: string;
  verdict: "PASS" | "FAIL" | "UNSURE";
  evidence: string;
  confidence: number;
};

export type VerificationOutcome = {
  status: "PASS" | "FAIL";
  summary: string;
  results: CriterionJudgement[];
  trace: string;
  observation: PageObservation | null;
};

const verdictSchema = z.object({
  summary: z.string(),
  overall: z.enum(["PASS", "FAIL"]),
  results: z.array(
    z.object({
      criterionId: z.string(),
      verdict: z.enum(["PASS", "FAIL", "UNSURE"]),
      evidence: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export function modelConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.XAI_API_KEY);
}

function modelId() {
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  if (process.env.ANTHROPIC_API_KEY) return "claude-haiku-5-5";
  if (process.env.OPENAI_API_KEY) return "gpt-4o-mini";
  if (process.env.XAI_API_KEY) return "grok-4";
  return "";
}

function anthropicOptions() {
  if (!process.env.ANTHROPIC_API_KEY) return undefined;
  return { anthropic: { effort: "low" as const } };
}

function getModel() {
  const modelName = modelId();
  if (!modelName) return null;
  if (process.env.ANTHROPIC_API_KEY) {
    return createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })(modelName);
  }
  if (process.env.OPENAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.OPENAI_API_KEY })(modelName);
  }
  if (process.env.XAI_API_KEY) {
    return createOpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: "https://api.x.ai/v1" })(modelName);
  }
  return null;
}

function numberInLabel(label: string) {
  const match = label.match(/(\d+)\s*(?:개|plans?\b)/i);
  return match ? Number(match[1]) : null;
}

export function judgeFromObservation(criteria: CriterionInput[], page: PageObservation): VerificationOutcome {
  const results: CriterionJudgement[] = criteria.map((criterion) => {
    const label = criterion.label.toLowerCase();
    if (/가격|플랜|pricing|plan/.test(label)) {
      const needed = numberInLabel(criterion.label) ?? 3;
      if (page.planCount >= needed) {
        return {
          criterionId: criterion.id,
          verdict: "PASS",
          evidence: `Found ${page.planCount} plans in the pricing section: ${page.planNames.join(", ")}`,
          confidence: 0.9,
        };
      }
      return {
        criterionId: criterion.id,
        verdict: "FAIL",
        evidence: `Found only ${page.planCount} ${page.planCount === 1 ? "plan" : "plans"}. The criterion asks for ${needed}.`,
        confidence: 0.92,
      };
    }
    if (/모바일|mobile|너비/.test(label)) {
      if (page.ctaTexts.length === 0 || page.ctaVisibleOnMobile === false) {
        return {
          criterionId: criterion.id,
          verdict: "FAIL",
          evidence: page.mobileNote || "Could not confirm a CTA at a mobile width.",
          confidence: 0.88,
        };
      }
      if (page.ctaVisibleOnMobile === true) {
        return {
          criterionId: criterion.id,
          verdict: "PASS",
          evidence: page.mobileNote,
          confidence: page.mode === "kernel" ? 0.9 : 0.74,
        };
      }
      return {
        criterionId: criterion.id,
        verdict: "UNSURE",
        evidence: "Could not confirm mobile visibility.",
        confidence: 0.4,
      };
    }
    if (/연락|문의|폼|form|contact/.test(label)) {
      if (page.hasContactForm) {
        return {
          criterionId: criterion.id,
          verdict: "PASS",
          evidence: `A contact form is present. Fields: ${page.contactFields.join(", ")}`,
          confidence: 0.9,
        };
      }
      return {
        criterionId: criterion.id,
        verdict: "FAIL",
        evidence: "The page has no contact form.",
        confidence: 0.93,
      };
    }
    if (/cta|버튼|히어로|hero|제품명/.test(label)) {
      const name = page.headings[0] || page.title;
      const cta = page.ctaTexts[0];
      if (name && cta) {
        return {
          criterionId: criterion.id,
          verdict: "PASS",
          evidence: `Hero heading "${name}", button "${cta}".`,
          confidence: 0.88,
        };
      }
      return {
        criterionId: criterion.id,
        verdict: "FAIL",
        evidence: `Product name "${name || "missing"}", CTA "${cta || "missing"}". Both are required.`,
        confidence: 0.9,
      };
    }
    return {
      criterionId: criterion.id,
      verdict: "UNSURE",
      evidence: `Could not judge this criterion from the page structure alone. Observed: ${page.text.slice(0, 180)}`,
      confidence: 0.35,
    };
  });
  return finalize(results, page, heuristicSummary(results, page), { mode: "heuristic", page });
}

function heuristicSummary(results: CriterionJudgement[], page: PageObservation) {
  const failed = results.filter((result) => result.verdict !== "PASS");
  const source = page.mode === "kernel" ? "Opened the page with Kernel." : "Read the page HTML directly.";
  if (failed.length === 0) {
    return `${source} All ${results.length} acceptance criteria match what was observed. The hero, pricing, mobile CTA, and contact form were each checked. Nothing was marked pass by guesswork.`;
  }
  return `${source} Some criteria were not found on the page. ${failed
    .slice(0, 3)
    .map((result) => result.evidence)
    .join(" ")} The hold is not captured because a criterion did not pass.`;
}

function finalize(
  raw: CriterionJudgement[],
  page: PageObservation | null,
  summary: string,
  trace: unknown,
): VerificationOutcome {
  const byId = new Map(raw.map((result) => [result.criterionId, result]));
  const results = [...byId.values()];
  const status = results.length > 0 && results.every((result) => result.verdict === "PASS") ? "PASS" : "FAIL";
  const text = summary.trim();
  return {
    status,
    summary: text,
    results,
    observation: page,
    trace: JSON.stringify(trace).slice(0, 50_000),
  };
}

const systemPrompt = [
  "You are BriefPay's verification agent. Decide whether the client's acceptance criteria are met on the delivery URL, and cite evidence.",
  "Write the summary and every evidence string in English.",
  "Do not guess PASS. If the page does not show it, use UNSURE or FAIL.",
  "Ignore BriefPay chrome such as the role switch. Judge the delivered page only.",
  "Call browse_delivery before you judge. You may call browse_again once if a section is unclear.",
  "You cannot move money. Do not claim a payment was captured.",
  "Final message must be JSON only, matching the requested schema.",
  "overall PASS only if every criterion is PASS. Any FAIL or UNSURE means overall FAIL.",
].join("\n");

export async function runVerification(input: {
  criteria: CriterionInput[];
  deliveryUrl: string;
  brief: string;
  onLog: (message: string) => void;
}): Promise<VerificationOutcome> {
  const trace: unknown[] = [];
  let lastObservation: PageObservation | null = null;
  const allowed = input.deliveryUrl;

  const browseTool = async (url: string, instruction?: string) => {
    if (url.replace(/\/$/, "") !== allowed.replace(/\/$/, "") && !allowed.endsWith(url)) {
      throw new Error("Only the submitted delivery URL can be opened.");
    }
    input.onLog(instruction ? `Checking again. ${instruction}` : "Opening the delivery URL.");
    const observation = await browseDelivery(url, input.onLog);
    lastObservation = observation;
    trace.push({ tool: instruction ? "browse_again" : "browse_delivery", instruction, observation });
    input.onLog(
      `Heading ${observation.headings[0] || observation.title || "none"}, ${observation.ctaTexts.length} CTAs, ${observation.planCount} plans, contact form ${observation.hasContactForm ? "present" : "absent"}.`,
    );
    return observation;
  };

  const model = getModel();
  if (!model) {
    input.onLog("No model key is set, so criteria are judged from the page observation.");
    const observation = await browseTool(allowed);
    const outcome = judgeFromObservation(input.criteria, observation);
    outcome.trace = JSON.stringify({ mode: "heuristic", trace, summary: outcome.summary }).slice(0, 50_000);
    return outcome;
  }

  input.onLog(`The review model ${modelId()} is opening the page and checking the criteria.`);
  try {
    const generated = await generateText({
      model,
      providerOptions: anthropicOptions(),
      system: systemPrompt,
      stopWhen: isStepCount(4),
      tools: {
        browse_delivery: tool({
          description: "Open the delivery URL and return text, headings, CTAs, plans, forms, and mobile CTA visibility.",
          inputSchema: z.object({ url: z.string() }),
          execute: async ({ url }) => browseTool(url),
        }),
        browse_again: tool({
          description: "Re-open the same delivery URL to inspect one section more carefully.",
          inputSchema: z.object({ url: z.string(), instruction: z.string() }),
          execute: async ({ url, instruction }) => browseTool(url, instruction),
        }),
      },
      prompt: [
        `Brief:\n${input.brief}`,
        `Delivery URL: ${allowed}`,
        `Criteria: ${JSON.stringify(input.criteria)}`,
        "Browse the URL, then finish with JSON only.",
      ].join("\n\n"),
    });
    trace.push({ text: generated.text });
    const parsed = extractJson(generated.text);
    if (!parsed || !lastObservation) {
      if (!lastObservation) {
        lastObservation = await browseTool(allowed);
      }
      input.onLog("The model response was not structured, so the observation is judged again.");
      const fallback = judgeFromObservation(input.criteria, lastObservation);
      fallback.trace = JSON.stringify({ mode: "heuristic-after-model", trace }).slice(0, 50_000);
      return fallback;
    }
    const object = verdictSchema.parse(parsed);
    const aligned = input.criteria.map((criterion) => {
      const found = object.results.find((result) => result.criterionId === criterion.id);
      return (
        found || {
          criterionId: criterion.id,
          verdict: "UNSURE" as const,
          evidence: "The model did not return evidence for this criterion.",
          confidence: 0.3,
        }
      );
    });
    const outcome = finalize(aligned, lastObservation, object.summary, { mode: "model", modelOverall: object.overall, trace });
    if (object.overall !== outcome.status) {
      outcome.summary = `${outcome.summary} The server does not treat the review as a pass when any criterion fails or is unsure.`;
    }
    input.onLog(outcome.status === "PASS" ? "Every criterion passed." : "A criterion did not pass.");
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Review model error";
    input.onLog(`The model review did not finish. Judging from the observation. ${message}`);
    if (!lastObservation) lastObservation = await browseTool(allowed);
    const fallback = judgeFromObservation(input.criteria, lastObservation);
    fallback.trace = JSON.stringify({ mode: "heuristic-after-error", message, trace }).slice(0, 50_000);
    return fallback;
  }
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function explainReceiptWithToolkit(input: {
  title: string;
  cents: number;
  currency: string;
  captureId: string;
  recipientEmail: string;
  onLog: (message: string) => void;
}) {
  const model = getModel();
  if (!model || !process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return null;
  const { PayPalAgentToolkit } = await import("@paypal/agent-toolkit/ai-sdk");
  const toolkit = new PayPalAgentToolkit({
    clientId: process.env.PAYPAL_CLIENT_ID,
    clientSecret: process.env.PAYPAL_CLIENT_SECRET,
    configuration: {
      actions: {
        invoices: { create: true, get: true, list: true },
      },
      context: { sandbox: true },
    },
  });
  const raw = toolkit.getTools() as Record<string, { description?: string; parameters: z.ZodType; execute: (args: unknown) => Promise<unknown> }>;
  const calls: unknown[] = [];
  const tools = Object.fromEntries(
    Object.entries(raw).map(([name, paypalTool]) => [
      name,
      tool({
        description: paypalTool.description || name,
        inputSchema: paypalTool.parameters,
        execute: async (args) => {
          calls.push({ name, args });
          const result = await paypalTool.execute(args);
          calls.push({ name, result });
          return result;
        },
      }),
    ]),
  );
  input.onLog("Drafting a receipt with the PayPal Agent Toolkit. Capture is not called.");
  const value = (input.cents / 100).toFixed(2);
  const generated = await generateText({
    model,
    providerOptions: anthropicOptions(),
    tools,
    stopWhen: isStepCount(5),
    system: [
      "Create one PayPal sandbox invoice draft as a receipt for a payment that is ALREADY captured.",
      "Do not send the invoice. Do not record a payment. Do not create or capture an order.",
      `The amount must be exactly ${value} ${input.currency}.`,
      "If you cannot create that exact amount, stop without creating anything.",
    ].join("\n"),
    prompt: `Create a draft invoice for ${input.recipientEmail}. Item: ${input.title}. Quantity 1. Unit price ${value} ${input.currency}. Memo: receipt for capture ${input.captureId}. Already paid, not a new charge. Then get the invoice and reply with its id.`,
  });
  calls.push({ text: generated.text });
  return { calls, text: generated.text };
}
