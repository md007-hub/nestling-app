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

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return false;

  const triggerAt = new Date(Date.now() + options.secondsFromNow * 1000);

  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: options.id ?? Math.floor(Math.random() * 100000),
          title: options.title,
          body: options.body,
          schedule: { at: triggerAt },
          sound: undefined,
          smallIcon: "ic_stat_name",
        },
      ],
    });
    return true;
  } catch (error) {
    console.error("Failed to schedule notification:", error);
    return false;
  }
}