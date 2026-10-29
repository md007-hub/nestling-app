import { Purchases, PurchasesPackage, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

const REVENUECAT_APPLE_KEY = import.meta.env.VITE_REVENUECAT_APPLE_KEY || 'appl_placeholder_api_key';
const REVENUECAT_GOOGLE_KEY = 'goog_JiDPWtsleJaGHEHYslElOicJtCe';

let purchasesReady: Promise<void> | null = null;

export const initPurchases = async (userId?: string) => {
  if (purchasesReady) return purchasesReady;

  purchasesReady = configurePurchases(userId).catch((error) => {
    purchasesReady = null;
    throw error;
  });

  return purchasesReady;
};

const configurePurchases = async (userId?: string) => {
  if (!Capacitor.isNativePlatform()) return;

  const apiKey =
    Capacitor.getPlatform() === 'ios'
      ? REVENUECAT_APPLE_KEY
      : REVENUECAT_GOOGLE_KEY;

  try {
    await Purchases.configure({
      apiKey,
      appUserID: userId ?? null,
    });
  } catch (error) {
    console.error('Error configuring RevenueCat:', error); throw error;
  }
};

export const getOfferings = async () => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (error) {
    console.error('Error fetching offerings:', error);
    return null;
  }
};

export const purchasePackage = async (pkg: PurchasesPackage): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return checkEntitlement(customerInfo);
  } catch (error) {
    console.error('Purchase failed or canceled:', error);
    return false;
  }
};

export const restorePurchases = async (): Promise<boolean> => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { customerInfo } = await Purchases.restorePurchases();
    return checkEntitlement(customerInfo);
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return false;
  }
};

export const checkEntitlement = (customerInfo: CustomerInfo, entitlementId = 'premium'): boolean => {
  return typeof customerInfo?.entitlements?.active?.[entitlementId] !== 'undefined';
};

export const getVerifiedCustomerInfo = async (userId: string): Promise<CustomerInfo | null> => {
  if (!Capacitor.isNativePlatform() || !userId) return null;

  try {
    await syncPurchaseUser(userId);
    const { customerInfo } = await Purchases.getCustomerInfo();
    const { appUserID } = await Purchases.getAppUserID();

    if (appUserID !== userId) {
      console.warn("RevenueCat account does not match signed-in parent");
      return null;
    }

    return customerInfo;
  } catch (error) {
    console.error("RevenueCat verification failed:", error);
    return null;
  }
};

export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.error('Error getting customer info:', error);
    return null;
  }
};


export async function syncPurchaseUser(userId: string | null) {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await initPurchases();
    if (userId) {
      await Purchases.logIn({ appUserID: userId });
    } else {
      const { customerInfo } = await Purchases.getCustomerInfo();
      if (!customerInfo.originalAppUserId.startsWith("$RCAnonymousID:")) {
        await Purchases.logOut();
      }
    }
  } catch (error) {
    console.error("RevenueCat account sync failed:", error);
  }
}






