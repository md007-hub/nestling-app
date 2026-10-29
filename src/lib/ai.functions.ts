import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reserveNannyQuestion, finishNannyQuestion } from "@/lib/ai-quota.server";

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

function getApiKey(name: string): string | undefined {
  const g = globalThis as Record<string, any>;

  const value =
    process.env[name] ||
    g[name] ||
    g?.env?.[name] ||
    g?.__env__?.[name];

  return typeof value === "string" && value.trim()
    ? value.trim()
    : undefined;
}

const GROQ_MODEL = "openai/gpt-oss-120b";
const GEMINI_MODEL = "gemini-3.8-flash";

const GROQ_TIMEOUT_MS = 12000;
const GEMINI_TIMEOUT_MS = 18000;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

async function askGroq(
  messages: ChatMessage[],
  systemInstruction: string,
  apiKey: string,
): Promise<string> {
  const startedAt = Date.now();

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: systemInstruction,
          },
          ...messages,
        ],
        temperature: 0.3,
        max_completion_tokens: 1024,
        reasoning_effort: "low",
      }),
      signal: AbortSignal.timeout(GROQ_TIMEOUT_MS),
    },
  );

  console.log("[NannyAI] Groq request completed", {
    status: response.status,
    elapsedMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    const details = await response.text();

    console.error("[NannyAI] Groq API error", {
      status: response.status,
      details: details.slice(0, 500),
    });

    throw new Error(`Groq HTTP ${response.status}`);
  }

  const json = (await response.json()) as any;

  const reply = json?.choices?.[0]?.message?.content;

  if (typeof reply !== "string" || !reply.trim()) {
    throw new Error("Groq returned an empty answer.");
  }

  return reply.trim();
}

async function askGemini(
  messages: ChatMessage[],
  systemInstruction: string,
  apiKey: string,
): Promise<string> {
  const startedAt = Date.now();

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        parts: [{ text: message.content }],
      })),
      generationConfig: {
        maxOutputTokens: 450,
        thinkingConfig: {
          thinkingLevel: "LOW",
        },
      },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });

  console.log("[NannyAI] Gemini request completed", {
    status: response.status,
    elapsedMs: Date.now() - startedAt,
  });

  if (!response.ok) {
    const details = await response.text();

    console.error("[NannyAI] Gemini API error", {
      status: response.status,
      details: details.slice(0, 500),
    });

    throw new Error(`Gemini HTTP ${response.status}`);
  }

  const json = (await response.json()) as any;

  const reply = json?.candidates?.[0]?.content?.parts
    ?.filter((part: any) => !part.thought)
    ?.map((part: any) => part.text ?? "")
    .join("")
    .trim();

  if (!reply) {
    throw new Error("Gemini returned an empty answer.");
  }

  return reply;
}

export const askBabyAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data, context }) => {
    const lastMessage = data.messages[data.messages.length - 1];

    if (!lastMessage || lastMessage.role !== "user") {
      return {
        reply: "Please enter a question before sending.",
      };
    }

    const contextSnippet = data.context
      ? data.context.slice(0, 1500)
      : "No baby logs recorded.";

    const systemInstruction = `
You are Nanny AI, a warm, careful baby-care assistant.

Answer the user's actual question directly in 2 to 5 short, clear sentences.
You are a general baby-care assistant, not limited to feeding and sleep.
Help with newborn care, soothing, crying, tummy time, bathing, nappy changes,
burping, safe sleep, development, routines, and common parenting questions.
Use conversation history and baby logs when relevant.
Never invent baby-log details or claim certainty when unsure.
For urgent symptoms or possible emergencies, advise the parent to seek
appropriate medical help immediately. Never recommend unsafe sleep practices.
For tummy time, explain that baby must be awake and supervised.
For sleep, recommend placing baby on their back on a firm, flat sleep surface.
If a question is unrelated to baby care, politely explain your focus.

Baby logs:
${contextSnippet}
`.trim();

    const messages = data.messages.slice(-12);

    const groqKey = getApiKey("GROQ_API_KEY");
    const geminiKey = getApiKey("GEMINI_API_KEY");

    if (!groqKey && !geminiKey) {
      console.error("[NannyAI] No AI API keys configured.");

      return {
        reply: "AI service is not configured. Please try again later.",
      };
    }

    let reservationId: string;

    try {
      const quota = await reserveNannyQuestion(context.userId);

      if (!quota.reservationId) {
        return {
          reply: "You've reached your Nanny AI question limit for today. Please try again tomorrow or upgrade to PRO.",
        };
      }

      reservationId = quota.reservationId;
    } catch (error) {
      console.error("[NannyAI] Quota check failed", error);

      return {
        reply: "Unable to check your question allowance right now. Please try again shortly.",
      };
    }

    let aiReply: string | null = null;

    if (groqKey) {
      try {
        aiReply = await askGroq(
          messages,
          systemInstruction,
          groqKey,
        );

        console.log("[NannyAI] Answer provided by Groq.");
      } catch (error) {
        console.error("[NannyAI] Groq failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!aiReply && geminiKey) {
      try {
        console.warn("[NannyAI] Trying Gemini fallback.");

        aiReply = await askGemini(
          messages,
          systemInstruction,
          geminiKey,
        );

        console.log("[NannyAI] Answer provided by Gemini.");
      } catch (error) {
        console.error("[NannyAI] Gemini fallback failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!aiReply) {
      try {
        await finishNannyQuestion(reservationId, false);
      } catch (error) {
        console.error("[NannyAI] Failed to release reservation", error);
      }

      return {
        reply: "Nanny AI is temporarily unavailable. Please try again shortly.",
      };
    }

    try {
      const completed = await finishNannyQuestion(reservationId, true);

      if (!completed) {
        return {
          reply: "Your question could not be finalized. Please try again.",
        };
      }
    } catch (error) {
      console.error("[NannyAI] Could not finalize successful answer", error);

      return {
        reply: "Unable to save your question usage. Please try again shortly.",
      };
    }

    return { reply: aiReply };
  });




