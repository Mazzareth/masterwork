// Firebase Cloud Messaging Service Worker (Compat API for SW)
//
// Loads firebase-app-compat and firebase-messaging-compat in the SW context,
// initializes with the same config as the web app, and displays background
// notifications when messages arrive while the page is unfocused or closed.

importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.2.1/firebase-messaging-compat.js");

// IMPORTANT: Keep in sync with src/lib/firebase.ts
firebase.initializeApp({
  apiKey: "AIzaSyAGqzBfhtt93kL4A3XsAq9ipjrTnsbb7QM",
  authDomain: "masterworkapp-qg9ri.firebaseapp.com",
  projectId: "masterworkapp-qg9ri",
  storageBucket: "masterworkapp-qg9ri.firebasestorage.app",
  messagingSenderId: "744876693801",
  appId: "1:744876693801:web:477acc7cdc07bc62867f38",
});

const messaging = firebase.messaging();

// Show a notification for background messages
messaging.onBackgroundMessage(async (payload) => {
  // Prefer values from the FCM notification payload if provided
  const title =
    (payload.notification && payload.notification.title) ||
    (payload.data && payload.data.title) ||
    "New message";
  const body =
    (payload.notification && payload.notification.body) ||
    (payload.data && payload.data.body) ||
    "You have a new chat message.";
  const icon =
    (payload.notification && payload.notification.icon) ||
    "/vercel.svg";

  const tag = (payload.data && payload.data.tag) || "chat";
  const url = (payload.data && payload.data.url) || "/";

  const options = {
    body,
    icon,
    tag,
    data: { url },
    // Ensure multiple messages collapse sensibly by tag
    renotify: true,
    badge: "/vercel.svg",
  };

  try {
    const reg = await self.registration.showNotification(title, options);
    return reg;
  } catch (e) {
    // noop
  }
});

// Click handler: focus an existing client or open the URL provided in payload
self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const targetUrl = (n && n.data && n.data.url) || "/";
  event.notification.close();

  // Focus if a client with the same origin is open; otherwise open a new one
  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const origin = self.location.origin;
      for (const client of allClients) {
        try {
          if (client.url && client.url.startsWith(origin)) {
            await client.focus();
            // If not already at target, navigate
            if (!client.url.endsWith(targetUrl)) {
              client.navigate(targetUrl).catch(() => {});
            }
            return;
          }
        } catch {
          // continue
        }
      }
      // No existing client; open a new window
      await clients.openWindow(targetUrl);
    })()
  );
});