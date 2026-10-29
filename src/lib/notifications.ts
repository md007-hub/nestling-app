
import { LocalNotifications } from "@capacitor/local-notifications";
import { Capacitor } from "@capacitor/core";

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return true;

  try {
    const status = await LocalNotifications.checkPermissions();
    if (status.display === "granted") return true;

    const request = await LocalNotifications.requestPermissions();
    return request.display === "granted";
  } catch (error) {
    console.error("Failed to request notification permissions:", error);
    return false;
  }
}

export async function checkExactAlarmPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return true;
  }

  try {
    const status = await LocalNotifications.checkExactNotificationSetting();
    return status.exact_alarm === "granted";
  } catch (error) {
    console.error("Failed to check exact alarm permission:", error);
    return false;
  }
}

export async function scheduleNativeReminder(options: {
  id: number;
  title: string;
  body: string;
  at: Date;
  every?: "day";
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: options.id,
          title: options.title,
          body: options.body,
          schedule: {
            at: options.at,
            ...(options.every ? { repeats: true, every: options.every } : {}),
            allowWhileIdle: true,
          },
          smallIcon: "ic_launcher",
        },
      ],
    });

    return true;
  } catch (error) {
    console.error("Failed to schedule native reminder:", error);
    return false;
  }
}

export async function cancelNativeReminders(ids: number[]): Promise<void> {
  if (!Capacitor.isNativePlatform() || ids.length === 0) return;

  try {
    await LocalNotifications.cancel({
      notifications: ids.map((id) => ({ id })),
    });
  } catch (error) {
    console.error("Failed to cancel native reminders:", error);
  }
}

export async function scheduleBabyReminder(options: {
  id?: number;
  title: string;
  body: string;
  secondsFromNow: number;
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log("LocalNotifications is only available on native platforms.");
    return false;
  }

  return scheduleNativeReminder({
    id: options.id ?? Math.floor(Math.random() * 100000),
    title: options.title,
    body: options.body,
    at: new Date(Date.now() + options.secondsFromNow * 1000),
  });
}
