type RevenueCatSubscriber = {
  subscriber?: {
    entitlements?: Record<string, {
      expires_date?: string | null;
      purchase_date?: string | null;
    }>;
  };
};

export async function hasVerifiedRevenueCatPro(userId: string): Promise<boolean> {
  const apiKey = process.env["REVENUECAT_SECRET_API_KEY"];

  if (!apiKey) {
    throw new Error("RevenueCat server API key is not configured");
  }

  const response = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    },
  );

  if (!response.ok) {
    throw new Error(`RevenueCat verification failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as RevenueCatSubscriber;
  const premium = data.subscriber?.entitlements?.premium;

  if (!premium) return false;

  if (premium.expires_date === null) return !!premium.purchase_date;

  if (!premium.expires_date) return false;

  const expiry = Date.parse(premium.expires_date);

  return Number.isFinite(expiry) && expiry > Date.now();
}

