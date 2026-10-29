import {
  AdMob,
  AdmobConsentStatus,
  RewardAdOptions,
  RewardAdPluginEvents,
} from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

let isInitialized = false;

export const initAdMob = async () => {
  if (!Capacitor.isNativePlatform() || isInitialized) return;

  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });

    await AdMob.setApplicationMuted({ muted: true });

    const [trackingInfo, consentInfo] = await Promise.all([
      AdMob.trackingAuthorizationStatus(),
      AdMob.requestConsentInfo(),
    ]);

    if (trackingInfo.status === 'notDetermined') {
      await AdMob.requestTrackingAuthorization();
    }

    if (
      consentInfo.isConsentFormAvailable &&
      consentInfo.status === AdmobConsentStatus.REQUIRED
    ) {
      await AdMob.showConsentForm();
    }

    isInitialized = true;
  } catch (error) {
    console.error('AdMob initialization error:', error);
  }
};

export const showBannerAd = async (_isPremiumUser = false) => {
  return;
};

export const hideBannerAd = async () => {
  return;
};

export const showRewardedAd = async (ssv?: { userId: string; customData: string }): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  await initAdMob();

  const options: RewardAdOptions = {
    adId:
      Capacitor.getPlatform() === 'ios'
        ? 'ca-app-pub-3940256099942544/1712485313'
        : 'ca-app-pub-3940256099942544/5224354917',
    isTesting: true,
    ...(ssv ? { ssv } : {}),
  };

  return new Promise<boolean>(async (resolve) => {
    let rewarded = false;

    const loadHandle = await AdMob.addListener(
      RewardAdPluginEvents.Loaded,
      async () => {
        try {
          await AdMob.showRewardVideoAd();
        } catch (err) {
          console.error('Failed to show rewarded ad:', err);
          cleanup();
          resolve(false);
        }
      }
    );

    const rewardHandle = await AdMob.addListener(
      RewardAdPluginEvents.Rewarded,
      () => {
        rewarded = true;
      }
    );

    const dismissHandle = await AdMob.addListener(
      RewardAdPluginEvents.Dismissed,
      () => {
        cleanup();
        resolve(rewarded);
      }
    );

    const failHandle = await AdMob.addListener(
      RewardAdPluginEvents.FailedToLoad,
      (err) => {
        console.error('Rewarded ad failed to load:', err);
        cleanup();
        resolve(false);
      }
    );

    const cleanup = () => {
      loadHandle.remove();
      rewardHandle.remove();
      dismissHandle.remove();
      failHandle.remove();
    };

    try {
      await AdMob.prepareRewardVideoAd(options);
    } catch (err) {
      console.error('Error preparing rewarded ad:', err);
      cleanup();
      resolve(false);
    }
  });
};
