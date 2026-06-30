import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "@/lib/supabase/client";

/** Expo Go (as opposed to a dev/standalone build) — push tokens were removed from it in SDK 53. */
const isExpoGo = Constants.appOwnership === "expo";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const CHANNEL_ID = "attendance-reminders";
const CLOCK_IN_NOTIFICATION_ID = "daily-clock-in-reminder";
const CLOCK_OUT_NOTIFICATION_ID = "daily-clock-out-reminder";
const FORGOT_CLOCKOUT_NOTIFICATION_ID = "forgot-clockout-reminder";

async function ensureNotificationChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "תזכורות נוכחות",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

/** Requests OS notification permission, returning whether it's granted. */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

function parseTimeValue(value: string | null): { hour: number; minute: number } | null {
  if (!value) return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/**
 * Re-schedules the two recurring daily local reminders (clock-in / clock-out)
 * to match the given settings, cancelling whichever ones are now disabled.
 * Cancel-then-reschedule keeps this idempotent regardless of prior state.
 */
export async function syncDailyReminders(settings: {
  daily_reminder_enabled: boolean;
  daily_in_time: string | null;
  daily_out_time: string | null;
}): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(CLOCK_IN_NOTIFICATION_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(CLOCK_OUT_NOTIFICATION_ID).catch(() => {});

  if (!settings.daily_reminder_enabled) return;

  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await ensureNotificationChannel();

  const inTime = parseTimeValue(settings.daily_in_time);
  if (inTime) {
    await Notifications.scheduleNotificationAsync({
      identifier: CLOCK_IN_NOTIFICATION_ID,
      content: {
        title: "תזכורת כניסה",
        body: "לא תשכחו להחתים כניסה היום",
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: inTime.hour,
        minute: inTime.minute,
        repeats: true,
      },
    });
  }

  const outTime = parseTimeValue(settings.daily_out_time);
  if (outTime) {
    await Notifications.scheduleNotificationAsync({
      identifier: CLOCK_OUT_NOTIFICATION_ID,
      content: {
        title: "תזכורת יציאה",
        body: "לא תשכחו להחתים יציאה בסוף היום",
        ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: outTime.hour,
        minute: outTime.minute,
        repeats: true,
      },
    });
  }
}

/**
 * Schedules a one-time "forgot to clock out?" reminder `afterHours` hours from
 * now. Called right after a successful clock-in when the setting is enabled.
 * Cancel-then-reschedule keeps this idempotent regardless of prior state.
 */
export async function scheduleForgotClockoutReminder(afterHours: number): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FORGOT_CLOCKOUT_NOTIFICATION_ID).catch(() => {});
  const granted = await requestNotificationPermissions();
  if (!granted) return;
  await ensureNotificationChannel();
  await Notifications.scheduleNotificationAsync({
    identifier: FORGOT_CLOCKOUT_NOTIFICATION_ID,
    content: {
      title: "שכחתם לצאת?",
      body: "יש משמרת פתוחה — אל תשכחו להחתים יציאה",
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(afterHours, 0.5) * 3600,
      repeats: false,
    },
  });
}

/**
 * Cancels the "forgot to clock out" reminder. Called after a successful
 * clock-out so the notification never fires when the user clocked out normally.
 */
export async function cancelForgotClockoutReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(FORGOT_CLOCKOUT_NOTIFICATION_ID).catch(() => {});
}

/**
 * Registers this device's Expo push token for `userId`, for the (future)
 * server-side push job. No-ops in Expo Go (push tokens require a dev/
 * standalone build since SDK 53) or without a linked EAS project — local
 * reminders must keep working regardless of either.
 */
export async function registerPushToken(userId: string): Promise<void> {
  try {
    if (isExpoGo || !Device.isDevice) return;
    const granted = await requestNotificationPermissions();
    if (!granted) return;
    await ensureNotificationChannel();

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (!token) return;

    await supabase
      .from("push_tokens")
      .upsert(
        { user_id: userId, expo_push_token: token, platform: Platform.OS },
        { onConflict: "user_id,expo_push_token" },
      );
  } catch {
    // Push token registration is best-effort (e.g. missing EAS project id,
    // simulator, or denied permission) — local reminders don't depend on it.
  }
}
