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

export const askBabyAi = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured yet.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.8-flash",
        messages: [
          {
            role: "system",
            content: data.context
              ? `${SYSTEM_PROMPT}\n\n## Baby's tracker data\n${data.context}`
              : SYSTEM_PROMPT,
          },
          ...data.messages,
        ],
      }),
    });

    if (res.status === 429) {
      return { reply: "Too many questions at once — please try again in a moment." };
    }
    if (res.status === 402) {
      return { reply: "The AI assistant is out of credits. Please top up to keep chatting." };
    }
    if (!res.ok) {
      throw new Error(`AI request failed (${res.status})`);
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return {
      reply: json.choices?.[0]?.message?.content ?? "Sorry, I couldn't come up with an answer.",
    };
  });
