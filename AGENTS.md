<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## App architecture
- Keep local-first tracking in Dexie and derive dashboard totals from live log queries, so offline writes immediately update the tracker.

## Brand system
- The Nestling brand mark is the hand-drawn feather app icon (`/icon-192.png` small, `/icon-512.png` splash/auth) — never the Lucide `<Feather />` vector. No bird/nest illustrations.
- Dexie stays the source of truth for the UI; src/lib/sync.ts pushes pending logs to `baby_logs` (keyed by client uuid) and applies realtime changes back into Dexie — keeps the app instant and offline-first.
- Pro access is checked via the `has_family_pro(env)` DB function (own or any co-parent's subscription) and Nanny AI's free limit via `consume_ai_question` — keeps family sharing and limits enforced in one place.
- Keep the introduction carousel shared between the signed-out home screen and the replayable tour, while onboarding is only for baby setup — prevents the two journeys from drifting apart.
- Growth percentiles use bundled WHO LMS tables computed client-side (weight and length/height 0–60 months; head circumference 0–24 months); measurements live in `baby_growth` since they're infrequent and shared.
- Baby profile dates use the shared calendar picker, and profile saves refresh FamilyProvider so growth and wake-window views use the updated baby immediately.
- Milestones are stored per baby in `baby_milestones` keyed by stable bracket:category:index ids from src/lib/milestones.ts — shared between parents; never reorder existing items.
- Offline app shell uses vite-plugin-pwa (generateSW, output to dist/client) registered only via src/lib/registerSW.ts; the worker imports notify-sw.js so reminders share one worker — prevents two workers fighting over the same scope.
