import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const createAdmobRewardRequest = createServerFn({
  method: "POST",
})
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin.rpc(
      "create_admob_reward_request" as any,
      {
        _user_id: context.userId,
      } as any,
    );

    if (error || typeof data !== "string") {
      console.error(
        "[AdMob] Unable to create reward request:",
        error?.message,
      );

      throw new Error(
        "Unable to prepare rewarded ad. Please try again.",
      );
    }

    return {
      token: data,
    };
  });
