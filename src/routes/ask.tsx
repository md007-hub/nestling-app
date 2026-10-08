import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Crown, Loader2, PlayCircle, Send, Sparkles, WifiOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { askBabyAi } from "@/lib/ai.functions";
import { buildBabyContext } from "@/lib/babyContext";
import { useHydrated, useOnline } from "@/hooks/useOnline";
import { cn } from "@/lib/utils";
import { useFamily } from "@/hooks/useFamily";
import { FREE_AI_DAILY, usePro } from "@/hooks/usePro";

export const Route = createFileRoute("/ask")({
  head: () => ({
    meta: [
      { title: "Nanny AI — Nestling" },
      {
        name: "description",
        content:
          "Ask Nanny AI routine baby care questions about feeding, sleep, diapers and soothing.",
      },
      { property: "og:title", content: "Nanny AI — Nestling" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Calm answers to routine baby care questions, any time of night.",
      },
    ],
  }),
  component: AskPage,
});

type Msg = { role: "user" | "assistant"; content: string };

const CHIPS = [
  { label: "🍼 Last feed time & amount", prompt: "When did baby last eat, and how much?" },
  { label: "⏱️ Current wake window", prompt: "How long has baby been awake in the current wake window?" },
  { label: "📊 Today's daily summary", prompt: "Give me a summary of today's feeds, diapers and sleep." },
  { label: "😴 Nap schedule for today", prompt: "Based on the last 3 days of sleep and baby's age, suggest a nap schedule for the rest of today." },
  { label: "🌙 Night sleep review", prompt: "Review the last 3 nights of sleep. Any patterns, and what could help longer stretches?" },
  { label: "💡 Fussy baby soothing tips", prompt: "Baby is fussy. What soothing tips could help right now, given today's log?" },
];

function Greeting() {
  return (
    <div className="rounded-[1.75rem] border border-lilac-foreground/20 bg-gradient-to-br from-lilac to-tummy-tint p-4 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card text-lilac-foreground shadow-soft"><Sparkles className="h-5 w-5" /></span>
        <h2 className="font-display text-lg font-bold leading-tight">Nanny AI</h2>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground">
        Hi, I'm Nanny AI. Need tips for improving nap duration or feeding?
      </p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
        I'm here for routine nursery, feeding, and sleep guidance. Always consult your
        pediatrician for medical emergencies.
      </p>
    </div>
  );
}

function AskPage() {
  const hydrated = useHydrated();
  const online = useOnline();
  const offline = hydrated && !online;

  const ask = useServerFn(askBabyAi);
  const { baby } = useFamily();
  const { isPro, openUpgrade, consumeQuestion, aiQuestionsRemaining, watchRewardedAd, grantAiBonus } = usePro();
  const outOfQuestions = !isPro && aiQuestionsRemaining === 0;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, outOfQuestions]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || loading || offline || outOfQuestions) return;
    if (!(await consumeQuestion())) return;
    const next: Msg[] = [...messages, { role: "user", content: question }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
       const context = await buildBabyContext(baby).catch(() => undefined);
      const res = await ask({ data: { messages: next, context } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[calc(100dvh-11rem)] flex-col pt-1">
      <h1 className="mb-4 text-2xl font-bold">Nanny AI</h1>

      {messages.length === 0 && <Greeting />}

      <div className="mt-3 flex-1 space-y-3 pb-36">
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] text-sm leading-relaxed",
              m.role === "user"
                ? "ml-auto rounded-3xl rounded-br-lg bg-sleep px-4 py-2.5 text-sleep-foreground shadow-soft"
                : "mr-auto rounded-3xl rounded-bl-lg bg-card px-4 py-3 text-card-foreground shadow-soft",
            )}
          >
            {m.role === "assistant" ? (
              <div className="space-y-2 [&_li]:ml-4 [&_li]:list-disc [&_strong]:font-semibold">
                <ReactMarkdown>{m.content}</ReactMarkdown>
              </div>
            ) : (
              m.content
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
          </div>
        )}
        <div ref={endRef} className="scroll-mb-40" />
      </div>

      {offline && (
        <p className="mb-2 flex items-center gap-2 rounded-xl bg-offline/15 px-3 py-2.5 text-sm font-medium text-offline">
          <WifiOff className="h-4 w-4" />
          Nanny AI requires an internet connection.
        </p>
      )}

      <div className="sticky bottom-20 z-10 -mx-4 bg-background/95 px-4 pb-2 pt-2 backdrop-blur">
      {outOfQuestions ? (
        <div className="mb-2 rounded-3xl bg-card p-4 shadow-soft">
          <p className="font-display text-base font-bold">You've reached your daily free questions.</p>
          <p className="mt-1 text-xs text-muted-foreground">Free questions reset at midnight.</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => watchRewardedAd(grantAiBonus)}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-semibold transition active:scale-[0.98]"
            >
              <PlayCircle className="h-5 w-5 text-lilac-foreground" /> Watch 1 quick ad (+3 questions)
            </button>
            <button
              type="button"
              onClick={() => openUpgrade()}
              className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-lilac px-4 text-sm font-bold text-lilac-foreground transition active:scale-[0.98]"
            >
              <Crown className="h-5 w-5" /> Get Unlimited with PRO
            </button>
          </div>
        </div>
      ) : (
        !isPro &&
        aiQuestionsRemaining !== null && (
          <p className="mb-2 text-center text-xs font-medium text-muted-foreground">
            {aiQuestionsRemaining} of {Math.max(FREE_AI_DAILY, aiQuestionsRemaining)} free questions remaining today
          </p>
        )
      )}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            disabled={offline || loading || outOfQuestions}
            onClick={() => void send(c.prompt)}
            className="min-h-10 shrink-0 whitespace-nowrap rounded-full border border-lilac-foreground/15 bg-tummy-tint px-4 text-sm font-semibold shadow-soft transition hover:bg-lilac active:scale-[0.98] disabled:opacity-50"
          >
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-lilac-foreground" />
            {c.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 rounded-[1.75rem] border border-lilac-foreground/15 bg-card p-2 shadow-soft"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={offline || outOfQuestions}
          rows={1}
          placeholder={offline ? "Offline — AI unavailable" : outOfQuestions ? "Daily free questions used" : "Ask Nanny AI anything..."}
          className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2.5 text-base outline-none placeholder:text-muted-foreground disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={offline || loading || outOfQuestions || input.trim().length === 0}
          aria-label="Send"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lilac text-lilac-foreground shadow-soft ring-1 ring-lilac-foreground/20 transition active:scale-90 disabled:opacity-40"
        >
          <Send className="h-5 w-5" />
        </button>
      </form>
      <p className="mt-1.5 text-center text-[11px] leading-snug text-muted-foreground">
        Nanny AI provides general guidance and is not a substitute for professional medical advice.
      </p>
      </div>
    </div>
  );
}
