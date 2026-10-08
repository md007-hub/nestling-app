import { Purchases, PurchasesPackage, CustomerInfo } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// Replace with your public API keys from app.revenuecat.com
const REVENUECAT_APPLE_KEY = 'appl_placeholder_api_key';
const REVENUECAT_GOOGLE_KEY = 'goog_placeholder_api_key';

export const initPurchases = async (userId?: string) => {
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
    console.error('Error configuring RevenueCat:', error);
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
  return typeof customerInfo.entitlements.active[entitlementId] !== 'undefined';
};