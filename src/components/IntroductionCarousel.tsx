import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ClipboardPlus, MessageCircleHeart, Sparkles, UsersRound } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useFamily } from "@/hooks/useFamily";

const featureSlides = [
  {
    icon: UsersRound,
    title: "Real-time Partner Sync",
    description: "Keep both parents on the same page with live updates, wherever you are.",
    label: "Care, together",
    tint: "bg-peach text-peach-foreground",
  },
  {
    icon: ClipboardPlus,
    title: "Mindful, Frictionless Care",
    description: "Feeds, sleep, diapers, solids & tummy time designed for exhausted parents.",
    label: "The little things, simply",
    tint: "bg-sage text-sage-foreground",
  },
  {
    icon: MessageCircleHeart,
    title: "Nanny AI & Doctor PDF",
    description: "Thoughtful pediatric guidance and one-tap clinical export reports.",
    label: "A little more reassurance",
    tint: "bg-sky text-sky-foreground",
  },
] as const;

const TOTAL_STEPS = featureSlides.length + 1; // step 0 = brand splash

export function IntroductionCarousel() {
  const [step, setStep] = useState(0);
  const touchStart = useRef<number | null>(null);
  const { user, baby } = useFamily();
  const destination = user ? (baby ? "/" : "/onboarding") : "/auth";
  const featureStep = step - 1; // 0-based index into featureSlides
  const onSplash = step === 0;
  const slide = featureSlides[featureStep] ?? featureSlides[0];
  const onLast = step === TOTAL_STEPS - 1;

  const go = (next: number) => setStep(Math.max(0, Math.min(TOTAL_STEPS - 1, next)));
  const primaryButton = "h-14 flex-1 rounded-full bg-sage text-base font-bold text-sage-foreground shadow-soft hover:bg-sage/80 motion-safe:transition motion-safe:active:scale-[0.98]";
  const secondaryButton = "h-14 flex-1 rounded-full border-border bg-background text-base font-semibold text-welcome-ink shadow-soft hover:bg-muted hover:text-welcome-ink";

  return (
    <div
      className="flex min-h-[calc(100dvh-3rem)] flex-col justify-between bg-background py-5 text-welcome-ink"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current === null) return;
        const delta = (event.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (Math.abs(delta) > 55) go(step + (delta < 0 ? 1 : -1));
        touchStart.current = null;
      }}
    >
      {onSplash ? (
        <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 flex flex-1 flex-col items-center justify-center text-center">
          <img
            src="/icon-512.png"
            alt="Nestling logo"
            className="h-28 w-28 rounded-3xl border border-sage-foreground/10 bg-sage/30 p-1 shadow-soft"
            draggable={false}
          />
          <h1 className="mt-6 font-display text-4xl font-bold">Nestling</h1>
          <p className="mt-4 max-w-xs text-base leading-relaxed text-muted-foreground">
            The calm, shared baby tracker for modern parents.
          </p>
        </div>
      ) : (
        <>
          {user && baby && (
            <div className="flex items-center justify-end">
              <Link to="/" className="text-xs font-medium text-muted-foreground underline underline-offset-4">Back to Tracker</Link>
            </div>
          )}

          <div key={featureStep} className="pt-8 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 motion-safe:duration-300">
            {(() => {
              const SlideIcon = slide.icon;
              return (
                <div className={`mb-9 flex aspect-[5/4] w-full items-center justify-center rounded-3xl ${slide.tint}`}>
                  {featureStep === 2 ? (
                    <div className="relative flex h-44 w-40 items-center justify-center rounded-3xl border border-current/15 bg-card/80 shadow-soft">
                      <ClipboardPlus aria-hidden="true" strokeWidth={1.35} className="h-24 w-24" />
                      <span className="absolute -right-5 top-5 flex h-16 w-16 items-center justify-center rounded-full bg-sky shadow-soft"><MessageCircleHeart aria-hidden="true" className="h-8 w-8" /></span>
                      <span className="absolute bottom-5 left-5 flex h-9 w-9 items-center justify-center rounded-full bg-card shadow-soft"><Sparkles aria-hidden="true" className="h-5 w-5" /></span>
                    </div>
                  ) : featureStep === 0 ? (
                    <div className="flex h-36 w-52 items-center justify-center rounded-full border border-current/15 bg-card/70 shadow-soft"><SlideIcon aria-hidden="true" strokeWidth={1.25} className="h-24 w-24" /></div>
                  ) : (
                    <SlideIcon aria-hidden="true" strokeWidth={1.1} className="h-24 w-24 opacity-90" />
                  )}
                </div>
              );
            })()}
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">{slide.label}</p>
            <h1 className="max-w-sm font-display text-3xl font-bold leading-tight">{slide.title}</h1>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground">{slide.description}</p>
          </div>
        </>
      )}

      <div className="space-y-6 pt-8">
        {!onSplash && (
          <div className="flex justify-center gap-2" aria-label={`Feature slide ${featureStep + 1} of ${featureSlides.length}`}>
            {featureSlides.map((item, index) => (
              <Button key={item.title} type="button" variant="ghost" aria-label={`Go to feature slide ${index + 1}`} aria-current={index === featureStep ? "step" : undefined} onClick={() => go(index + 1)} className="h-11 w-11 rounded-full p-0">
                <span className={`h-2.5 w-2.5 rounded-full ${index === featureStep ? "bg-sage-foreground" : "bg-muted-foreground/40"}`} />
              </Button>
            ))}
          </div>
        )}
        <div className="flex gap-3">
          {step > 1 && <Button variant="outline" type="button" aria-label="Previous slide" onClick={() => go(step - 1)} className="h-14 w-14 rounded-full p-0 text-welcome-ink"><ArrowLeft /></Button>}
          {onSplash ? (
            <>
              <Button type="button" onClick={() => go(1)} className={primaryButton}>Get Started <ArrowRight /></Button>
              {user && baby ? (
                <Button asChild variant="outline" className={secondaryButton}><Link to="/">Back to Tracker</Link></Button>
              ) : (
                <Button asChild variant="outline" className={secondaryButton}><Link to="/auth">Log In</Link></Button>
              )}
            </>
          ) : !onLast ? (
            <Button type="button" onClick={() => go(step + 1)} className={primaryButton}>Next <ArrowRight /></Button>
          ) : (
            <Button asChild className={primaryButton}>{destination === "/auth" ? <Link to="/auth" search={{ mode: "up" }}>Get Started <ArrowRight /></Link> : <Link to={destination}>Get Started <ArrowRight /></Link>}</Button>
          )}
        </div>
        {!onSplash && !user && (
          <p className="text-center text-xs text-muted-foreground">
            <Link to="/auth" className="underline underline-offset-4">Already have an account? Log In</Link>
          </p>
        )}
      </div>
    </div>
  );
}
