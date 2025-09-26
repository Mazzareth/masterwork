import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

import { deterministicChatId } from "./linking";

export type CommissionSlugDoc = {
  ownerId: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

function isValidSlug(s: string): boolean {
  return /^[a-z0-9](?:[a-z0-9_-]{1,30}[a-z0-9])?$/.test(s);
}

/**
 * Reserve a global commission slug for the owner and mirror it to owner settings.
 * - Reserves/claims /commissionSlugs/{slug} with { ownerId }
 * - Writes /users/{ownerId}/sites/zzq/settings.commissionSlug = slug
 * - If previousSlug is provided and owned by the same owner, it is deleted.
 */
export async function reserveCommissionSlug(params: {
  ownerId: string;
  slug: string;
  previousSlug?: string;
}): Promise<{ slug: string; url: string }> {
  const ownerId = params.ownerId;
  const slug = (params.slug || "").toLowerCase().trim();
  if (!isValidSlug(slug)) {
    throw new Error("INVALID_SLUG");
  }

  // Release previous slug if changing
  if (params.previousSlug && params.previousSlug !== slug) {
    try {
      const prevRef = doc(db, "commissionSlugs", params.previousSlug);
      const prevSnap = await getDoc(prevRef);
      if (prevSnap.exists()) {
        const prev = prevSnap.data() as CommissionSlugDoc;
        if (prev.ownerId === ownerId) {
          await deleteDoc(prevRef);
        }
      }
    } catch {
      // best-effort cleanup
    }
  }

  // Reserve new slug
  const ref = doc(db, "commissionSlugs", slug);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as CommissionSlugDoc;
    if (data.ownerId !== ownerId) {
      throw new Error("SLUG_TAKEN");
    }
  }
  await setDoc(
    ref,
    {
      ownerId,
      createdAt: snap.exists()
        ? (snap.data() as CommissionSlugDoc).createdAt ?? (serverTimestamp() as unknown as Timestamp)
        : (serverTimestamp() as unknown as Timestamp),
      updatedAt: serverTimestamp() as unknown as Timestamp,
    } as CommissionSlugDoc,
    { merge: true }
  );

  // Mirror to owner settings
  try {
    const settingsRef = doc(db, "users", ownerId, "sites", "zzq", "config", "settings");
    await setDoc(
      settingsRef,
      { commissionSlug: slug, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch {
    // ignore
  }

  const base = typeof window !== "undefined" ? window.location.origin : "https://app.masterwork.app";
  return { slug, url: `${base}/commission/${slug}` };
}

/**
 * Ensure a chat exists between artist (ownerId) and client (userId) for a commission flow.
 * - Does NOT write under the owner's ZZQ subtree (client lacks permission).
 * - Uses a stable pseudo clientId derived from userId; stores a commissionRef string.
 * - Ensures canonical /chats/{chatId} with participants [ownerId, userId].
 * - Creates per-user chat summaries for owner and client (participants can write owner's summary via rules).
 * - Creates client-side link mirror at /users/{userId}/sites/cc/links/{chatId}.
 */
export async function openOrEnsureCommissionChat(params: {
  ownerId: string;
  userId: string;
  slug?: string;
  clientDisplayName?: string | null;
}): Promise<{ chatId: string; clientId: string }> {
  const { ownerId, userId, slug } = params;
  const clientDisplayName = (params.clientDisplayName || "").trim() || "Client";

  // Do not write into owner's ZZQ subtree from client.
  // Use a stable pseudo client id; include userId ensures uniqueness per user.
  const clientId = `u:${userId}`;
  const clientRef = slug ? `commissionSlug:${slug}` : "commissionSlug";

  const chatId = deterministicChatId(ownerId, clientId, userId);

  // Ensure canonical chat exists with participants
  const chatRef = doc(db, "chats", chatId);
  await setDoc(
    chatRef,
    {
      ownerId,
      userId,
      clientId,
      clientRef,
      participants: [ownerId, userId],
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Owner's per-user chat summary (allowed by rules for participants)
  try {
    const ownerSummaryRef = doc(db, "users", ownerId, "sites", "cc", "chats", chatId);
    await setDoc(
      ownerSummaryRef,
      {
        chatId,
        ownerId,
        userId,
        clientId,
        clientDisplayName,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // ignore
  }

  // Client's per-user chat summary and link mirror
  try {
    const userSummaryRef = doc(db, "users", userId, "sites", "cc", "chats", chatId);
    await setDoc(
      userSummaryRef,
      {
        chatId,
        ownerId,
        userId,
        clientId,
        clientDisplayName,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
    const userLinkRef = doc(db, "users", userId, "sites", "cc", "links", chatId);
    await setDoc(
      userLinkRef,
      {
        linkId: chatId,
        ownerId,
        userId,
        clientId,
        clientDisplayName,
        clientRef,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch {
    // ignore
  }

  return { chatId, clientId };
}