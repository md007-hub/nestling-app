# NurseryShift Companion

Build a mobile-first Progressive Web App for new parents called "NurseryShift". Use React, Tailwind CSS, Lucide-react icons, and Dexie.js for offline IndexedDB storage.

Key Architecture & Screens:

1. Offline-First Database (Dexie.js):

   - Set up an IndexedDB table named `logs` with fields: id, type ('feed' | 'diaper' | 'sleep'), value, notes, timestamp, sync_status ('synced' | 'pending').

   - When the user adds any entry, save it directly to Dexie first so it works 100% offline.

   - Add an online/offline listener with a subtle status badge at the top: "🟢 Online" or "🟡 Offline (Saving locally)".

2. Main Bottom Navigation (3 Tabs):

   - Tab 1: "Tracker"

     * Quick-action logging cards at the top:

       - Feed: One-tap button for Bottle (presets: 60ml, 90ml, 120ml) and Breastfeed (Left/Right timer).

       - Diaper: One-tap toggle for Wet, Dirty, or Both.

       - Sleep: Simple Start/Stop nap timer.

     * Below the buttons, show a chronological timeline of today's logged events directly from Dexie (`useLiveQuery`).

   - Tab 2: "Sounds"

     * Clean sound player with audio generator buttons for White Noise, Pink Noise, and Brown Noise using the Web Audio API.

     * Include a Play/Pause button and a simple timer (15m, 30m, 60m, Continuous).

   - Tab 3: "Ask AI"

     * Chat interface for routine baby care questions.

     * If the device is offline, disable the input and display: "AI Assistant requires an internet connection."

3. Design & UX:

   - Modern, gentle mobile nursery theme (soft slate, warm neutral backgrounds, high-contrast dark mode support for night feeds).

   - Large, thumb-friendly buttons designed for one-handed operation.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://baby-log-zen.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f4e49f78-6524-4f2a-bce8-5e560e0df685).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
