
import { createFileRoute } from "@tanstack/react-router";
import { ADMOB_NANNY_PRODUCTION_IDS } from "@/lib/admob-config";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EXPECTED_AD_UNITS = new Set<string>([
  ADMOB_NANNY_PRODUCTION_IDS.android,
  ADMOB_NANNY_PRODUCTION_IDS.ios,
]);

const MAX_CALLBACK_AGE_MS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 2 * 60 * 1000;

export const Route = createFileRoute("/api/public/admob/verify")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const rawUrl = request.url;
        const params = new URL(rawUrl).searchParams;

        const transactionId = params.get("transaction_id");
        const userId = params.get("user_id");
        const tokenText = params.get("custom_data");
        const adUnit = params.get("ad_unit");
        const rewardAmount = params.get("reward_amount");
        const rewardItem = params.get("reward_item");
        const timestampText = params.get("timestamp");

        if (
          !transactionId ||
          !userId ||
          !tokenText ||
          !adUnit ||
          !rewardAmount ||
          !rewardItem ||
          !timestampText
        ) {
          return new Response("Missing reward parameters", {
            status: 400,
          });
        }

        if (
          !UUID_PATTERN.test(userId) ||
          !UUID_PATTERN.test(tokenText)
        ) {
          return new Response("Invalid reward identifiers", {
            status: 400,
          });
        }

        try {
          const { verifyAdmobSignature } = await import(
            "@/lib/admob-verify.server"
          );

          if (!(await verifyAdmobSignature(rawUrl))) {
            return new Response("Invalid AdMob signature", {
              status: 401,
            });
          }

          // Only Nestling's registered production rewarded ads qualify.
          if (!EXPECTED_AD_UNITS.has(adUnit)) {
            return new Response("Unexpected ad unit", {
              status: 403,
            });
          }

          // Match the reward configured in Google AdMob.
          if (rewardAmount !== "3" || rewardItem !== "AI Questions") {
            return new Response("Unexpected reward", {
              status: 403,
            });
          }

          // Google supplies the timestamp in milliseconds.
          if (!/^\d{13}$/.test(timestampText)) {
            return new Response("Invalid timestamp", {
              status: 400,
            });
          }

          const callbackTime = Number(timestampText);
          const age = Date.now() - callbackTime;

          if (
            !Number.isSafeInteger(callbackTime) ||
            age > MAX_CALLBACK_AGE_MS ||
            age < -MAX_FUTURE_SKEW_MS
          ) {
            return new Response("Expired reward notification", {
              status: 403,
            });
          }

          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          const utcDay = new Date().toISOString().slice(0, 10);

          const { data, error } = await supabaseAdmin.rpc(
            "apply_verified_admob_reward" as any,
            {
              _transaction_id: transactionId,
              _user_id: userId,
              _day: utcDay,
              _token: tokenText,
            } as any,
          );

          if (error) {
            console.error(
              "[AdMob] Reward redemption failed:",
              error.message,
            );

            return new Response("Reward processing failed", {
              status: 500,
            });
          }

          if (data !== true) {
            return new Response("Reward already used or invalid", {
              status: 409,
            });
          }

          console.log("[AdMob] Verified reward applied.");

          return new Response("OK", { status: 200 });
        } catch (error) {
          console.error("[AdMob] Callback failed:", error);

          return new Response("Reward verification failed", {
            status: 500,
          });
        }
      },
    },
  },
});
