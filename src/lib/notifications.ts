"use client";

import app, { db } from "./firebase";
import { doc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import {
  getMessaging,
  getToken,
  deleteToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";

/**
 * Request browser push permission, register the FCM service worker,
 * obtain an FCM token, and store it under:
 *   /users/{uid}/notificationTokens/{token}
 *
 * Returns the FCM token (string) on success, or null if unsupported/denied/misconfigured.
 */
export async function ensurePushPermissionAndToken(userId: string): Promise<string | null> {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn("[notifications] FCM is not supported in this browser");
      return null;
    }

    // Permission
    let perm = Notification.permission;
    if (perm === "default") {
      perm = await Notification.requestPermission();
    }
    if (perm !== "granted") {
      console.info("[notifications] Notification permission not granted:", perm);
      return null;
    }

    // Service Worker (required for background messages)
    let reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      } catch (e) {
        console.error("[notifications] Failed to register service worker:", e);
        return null;
      }
    }

    // VAPID key: must be set as NEXT_PUBLIC_FIREBASE_VAPID_KEY in env
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn("[notifications] Missing NEXT_PUBLIC_FIREBASE_VAPID_KEY; cannot get FCM token");
      return null;
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    }).catch((e) => {
      console.error("[notifications] getToken error:", e);
      return null;
    });

    if (!token) return null;

    // Store/refresh token under user-owned path (guarded by rules)
    try {
      const ref = doc(db, "users", userId, "notificationTokens", token);
      await setDoc(
        ref,
        {
          token,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
          ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("[notifications] Failed to write token doc (will still return token):", e);
    }

    return token;
  } catch (e) {
    console.error("[notifications] ensurePushPermissionAndToken failed:", e);
    return null;
  }
}

/**
 * Foreground message subscription (no SW needed).
 * Use inside client components to show in-app toasts.
 */
export async function subscribeToForegroundMessages(
  handler: (payload: MessagePayload) => void
): Promise<() => void> {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    return () => {};
  }
  const messaging = getMessaging(app);
  const unsub = onMessage(messaging, (payload) => handler(payload));
  return unsub;
}

/**
 * Try to resolve the current device's FCM token without prompting the user.
 * Returns null if unsupported, permission not granted, missing VAPID key, or any error.
 */
export async function getCurrentFcmTokenIfSupported(): Promise<string | null> {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return null;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return null;
    }
    // Ensure service worker is registered (same path as ensurePushPermissionAndToken)
    let reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      } catch {
        return null;
      }
    }
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    if (!vapidKey) return null;
    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: reg,
    }).catch(() => null);
    return token || null;
  } catch {
    return null;
  }
}

/**
 * Disable push notifications for this browser/device:
 * - Deletes the current FCM token from Firebase Messaging
 * - Removes the stored token document under /users/{uid}/notificationTokens/{token}
 * Returns true on best-effort success, false on unsupported/error.
 */
export async function disablePushForThisDevice(userId: string): Promise<boolean> {
  try {
    const supported = await isSupported().catch(() => false);
    if (!supported) return false;

    // Try to resolve the current token so we can delete the Firestore doc
    let reg = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
    if (!reg) {
      try {
        reg = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      } catch {
        // proceed without reg; deleteToken below may still succeed
      }
    }
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
    const messaging = getMessaging(app);

    let currentToken: string | null = null;
    if (typeof Notification !== "undefined" && Notification.permission === "granted" && vapidKey && reg) {
      currentToken = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: reg,
      }).catch(() => null);
    }

    // Delete the FCM token for this device
    await deleteToken(messaging).catch(() => {});

    // Best-effort: remove the token document if we resolved it
    if (currentToken) {
      try {
        const ref = doc(db, "users", userId, "notificationTokens", currentToken);
        await deleteDoc(ref);
      } catch {
        // ignore
      }
    }
    return true;
  } catch {
    return false;
  }
}