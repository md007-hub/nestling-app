import { createFileRoute } from "@tanstack/react-router";
import { IntroductionCarousel } from "@/components/IntroductionCarousel";

export const Route = createFileRoute("/tour")({
  head: () => ({ meta: [
    { title: "App Tour · Nestling" },
    { name: "description", content: "Discover how Nestling helps families track care together." },
    { property: "og:title", content: "App Tour · Nestling" },
    { property: "og:description", content: "Discover how Nestling helps families track care together." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: IntroductionCarousel,
});