import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    .max(40),
  context: z.string().max(12000).optional(),
});

const SYSTEM_PROMPT = `You are Nanny AI, a warm, wise "Elder Guardian" co-parenting helper for new parents.
You are given the baby's actual activity logs from the parent's tracker. When a question relates to feeds,
diapers, sleep or wake windows, ground your answer in that data and quote exact times and amounts.
If the data needed isn't logged, say so kindly. Never invent log entries.
Answer routine baby-care questions (feeding, sleep, diapers, soothing, milestones) in short, warm,
plain language. Use markdown sparingly — short paragraphs or brief bullet lists.
Always remind the parent to contact their pediatrician or emergency services for anything urgent,
medical, or concerning (fever, breathing trouble, dehydration, injury). Never diagnose. For fever, health worries or emergencies, calmly direct them to their pediatrician.`;

function getGeminiKey(): string | undefined {
  const g = globalThis as Record<string, any>;
  return (
    process.env["GEMINI_API_KEY"] ||
    g["GEMINI_API_KEY"] ||
    g?.env?.["GEMINI_API_KEY"] ||
    g?.__env__?.["GEMINI_API_KEY"]
  );
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const askBabyAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = getGeminiKey();
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured in Cloudflare or .env");
    }

    const systemInstruction = data.context
      ? `${SYSTEM_PROMPT}\n\n## Baby's tracker data\n${data.context}`
      : SYSTEM_PROMPT;

    const contents = data.messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`;
    const payload = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
    };

    let res: Response | null = null;
    let attempts = 0;

    // Retry up to 3 times if Google returns temporary 503 or 429
    while (attempts < 3) {
      attempts++;
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.status !== 503 && res.status !== 429) {
        break;
      }

      if (attempts < 3) {
        await sleep(1500 * attempts);
      }
    }

    if (!res) {
      throw new Error("Network request could not be completed.");
    }

    if (res.status === 429 || res.status === 503) {
      return {
        reply: "Nanny AI is experiencing heavy traffic right now — please try again in just a moment!",
      };
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    return {
      reply:
        json.candidates?.[0]?.content?.parts?.[0]?.text ??
        "Sorry, I couldn't come up with an answer.",
    };
  });