import { AdMob, BannerAdOptions, BannerAdSize, BannerAdPosition, AdmobConsentStatus } from '@capacitor-community/admob';
import { Capacitor } from '@capacitor/core';

export const initAdMob = async () => {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await AdMob.initialize({
      initializeForTesting: true,
    });

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
  } catch (error) {
    console.error('AdMob initialization error:', error);
  }
};

export const showBannerAd = async (isPremiumUser = false) => {
  if (!Capacitor.isNativePlatform() || isPremiumUser) return;

  const options: BannerAdOptions = {
    adId:
      Capacitor.getPlatform() === 'ios'
        ? 'ca-app-pub-3940256099942544/2934735716' // Official iOS test banner ID
        : 'ca-app-pub-3940256099942544/6300978111', // Official Android test banner ID
    adSize: BannerAdSize.ADAPTIVE_BANNER,
    position: BannerAdPosition.BOTTOM_CENTER,
    margin: 0,
    isTesting: true,
  };

  try {
    await AdMob.showBanner(options);
  } catch (error) {
    console.error('Error showing banner ad:', error);
  }
};

export const hideBannerAd = async () => {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await AdMob.hideBanner();
  } catch (error) {
    console.error('Error hiding banner ad:', error);
  }
};