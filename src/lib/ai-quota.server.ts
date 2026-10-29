import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { hasVerifiedRevenueCatPro } from "@/lib/revenuecat.server";

function getUtcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function reserveNannyQuestion(userId: string) {
  const isPro = await hasVerifiedRevenueCatPro(userId);

  const { data, error } = await supabaseAdmin.rpc(
    "reserve_ai_question" as any,
    {
      _user_id: userId,
      _day: getUtcDay(),
      _is_pro: isPro,
    } as any,
  );

  if (error) {
    console.error("[NannyAI] Reservation failed", error.message);
    throw new Error("Unable to check AI question allowance.");
  }

  return {
    reservationId: data as string | null,
    isPro,
  };
}

export async function finishNannyQuestion(
  reservationId: string,
  success: boolean,
): Promise<boolean> {
  const { data, error } = await supabaseAdmin.rpc(
    "finish_ai_question" as any,
    {
      _reservation_id: reservationId,
      _success: success,
    } as any,
  );

  if (error) {
    console.error("[NannyAI] Finalization failed", error.message);
    throw new Error("Unable to finalize AI question.");
  }

  return data === true;
}
