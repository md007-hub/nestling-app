
export const ADMOB_TEST_REWARDED_IDS = {
  android: "ca-app-pub-3940256099942544/5224354917",
  ios: "ca-app-pub-3940256099942544/1712485313",
} as const;

// Nestling's real Google AdMob rewarded-ad unit IDs.
// Keep test ads enabled until server verification is ready.
export const ADMOB_NANNY_PRODUCTION_IDS = {
  android: "ca-app-pub-4370096786755848/2977694650",
  ios: "ca-app-pub-4370096786755848/1382461820",
} as const;

export const isNannyRewardConfigured = () =>
  Boolean(
    ADMOB_NANNY_PRODUCTION_IDS.android &&
    ADMOB_NANNY_PRODUCTION_IDS.ios
  );
