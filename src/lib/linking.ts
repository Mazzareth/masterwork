import { db } from "./firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";

/**
 * Firestore document shapes for invites, links, and chats.
 */

export type InviteStatus = "active" | "expired" | "used" | "revoked";

export type InviteDoc = {
  token: string; // doc id
  ownerId: string;
  clientId: string;
  clientRef: string; // "/users/{ownerId}/sites/zzq/clients/{clientId}"
  clientDisplayName: string;
  createdAt?: Timestamp;
  expiresAt?: Timestamp | null;
  usedAt?: Timestamp | null;
  usedBy?: string | null;
  status: InviteStatus;
};

export type ChatDoc = {
  ownerId: string;
  userId: string; // linked client's uid
  clientId: string;
  clientRef: string;
  participants: string[]; // [ownerId, userId]
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp | null;
};

export type ChatSummary = {
  chatId: string;
  ownerId: string;
  userId: string;
  clientId: string;
  clientDisplayName: string;
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp | null;
  lastReadAt?: Timestamp | null; // per-user read marker for "New Messages"
};

export type ClientLink = {
  linkId: string;
  ownerId: string;
  userId: string;
  clientId: string;
  clientDisplayName: string;
  clientRef: string;
  createdAt?: Timestamp;
  revokedAt?: Timestamp | null;
};

/**
 * Utilities
 */

// Base64url encoder for Uint8Array
function base64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  const b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bin, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/**
 * Generate a cryptographically-strong random token (base64url, 22 chars for 16 bytes).
 */
export function secureRandomToken(byteLen = 16): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const arr = new Uint8Array(byteLen);
    crypto.getRandomValues(arr);
    return base64url(arr);
  }
  // Fallback (non-crypto) – acceptable for dev; prefer crypto in production
  const arr = new Uint8Array(byteLen);
  for (let i = 0; i < byteLen; i++) arr[i] = Math.floor(Math.random() * 256);
  return base64url(arr);
}

/**
 * Deterministic chat id for (ownerId, clientId, userId).
 * Uses a simple stable 32-bit FNV-1a hash, hex-encoded.
 */
export function deterministicChatId(ownerId: string, clientId: string, userId: string): string {
  const s = `${ownerId}:${clientId}:${userId}`;
  // 32-bit FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const hex = ("00000000" + h.toString(16)).slice(-8);
  return `c_${hex}`;
}

export function defaultInviteExpiry(days = 7): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}

/**
 * Owner-only: create an invite under `/users/{ownerId}/sites/zzq/invites/{token}`.
 */
export async function createInvite(params: {
  ownerId: string;
  clientId: string;
  clientDisplayName: string;
  expiresAt?: Timestamp;
}): Promise<{ token: string; url: string }> {
  const { ownerId, clientId, clientDisplayName } = params;
  const token = secureRandomToken(16);
  const expiresAt = params.expiresAt ?? defaultInviteExpiry(7);
  const clientRef = `/users/${ownerId}/sites/zzq/clients/${clientId}`;

  const ref = doc(db, "users", ownerId, "sites", "zzq", "invites", token);
  const payload: InviteDoc = {
    token,
    ownerId,
    clientId,
    clientRef,
    clientDisplayName,
    createdAt: serverTimestamp() as unknown as Timestamp,
    expiresAt,
    status: "active",
    usedAt: null,
    usedBy: null,
  };
  await setDoc(ref, payload);

  // Construct acceptance URL; consumer should use window.location.origin in UI if needed.
  const base =
    typeof window !== "undefined" ? window.location.origin : "https://app.masterwork.app";
  const url = `${base}/cc/link?ownerId=${encodeURIComponent(ownerId)}&token=${encodeURIComponent(
    token
  )}`;

  return { token, url };
}

/**
 * Validate whether an invite document is currently usable.
 */
export function isInviteUsable(inv: InviteDoc | undefined | null): { ok: boolean; reason?: string } {
  if (!inv) return { ok: false, reason: "Invite not found" };
  if (inv.status !== "active") return { ok: false, reason: `Invite ${inv.status}` };
  if (inv.expiresAt && Timestamp.now().toMillis() >= inv.expiresAt.toMillis()) {
    return { ok: false, reason: "Invite expired" };
  }
  return { ok: true };
}

/**
 * Accept an invite as the linked user.
 * Creates/ensures:
 * - canonical chat `/chats/{chatId}`
 * - client user's chat summary `/users/{userId}/sites/cc/chats/{chatId}`
 * - client user's link entry `/users/{userId}/sites/cc/links/{linkId}`
 * - marks invite used (usedAt, usedBy, status="used")
 *
 * Notes:
 * - Owner-side mirrors (owner chat summary and owner link entry) should be created by the owner-side app
 *   when it observes a used invite; owner has permission to write under their own subtree.
 */
export async function acceptInvite(params: {
  ownerId: string;
  token: string;
  userId: string;
}): Promise<{
  chatId: string;
  clientId: string;
  clientDisplayName: string;
}> {
  const { ownerId, token, userId } = params;

  // 1) Load invite (must be allowed for signed-in users by rules)
  let invite: InviteDoc | null = null;
  const inviteRef = doc(db, "users", ownerId, "sites", "zzq", "invites", token);
  try {
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) {
      throw new Error("INVITE_NOT_FOUND");
    }
    invite = snap.data() as InviteDoc;
  } catch {
    throw new Error("PERM_INVITE_GET");
  }

  const usable = isInviteUsable(invite);
  if (!usable.ok) {
    throw new Error(usable.reason || "INVITE_NOT_USABLE");
  }

  const { clientId, clientDisplayName, clientRef } = invite!;
  const chatId = deterministicChatId(ownerId, clientId, userId);

  // 2) Ensure canonical chat exists (participant-only create)
  // Avoid preliminary get() which can fail rules when the doc doesn't exist.
  const chatRef = doc(db, "chats", chatId);
  try {
    const chatPayload: ChatDoc = {
      ownerId,
      userId,
      clientId,
      clientRef,
      participants: [ownerId, userId],
      createdAt: serverTimestamp() as unknown as Timestamp,
      lastMessageAt: null,
    };
    // Attempt create-or-merge in a single write. On first accept this triggers `create`;
    // on duplicate accept it triggers `update` (must already include user as participant).
    await setDoc(chatRef, chatPayload, { merge: true });
  } catch {
    // If this fails, rules likely blocked CREATE/UPDATE for this user.
    throw new Error("PERM_CHAT_CREATE");
  }

  // 3) Create client user's chat summary (self-owned path)
  try {
    const userChatRef = doc(db, "users", userId, "sites", "cc", "chats", chatId);
    const summary: ChatSummary = {
      chatId,
      ownerId,
      userId,
      clientId,
      clientDisplayName,
      createdAt: serverTimestamp() as unknown as Timestamp,
      lastMessageAt: null,
    };
    await setDoc(userChatRef, summary, { merge: true });
  } catch {
    throw new Error("PERM_SUMMARY_SET");
  }

  // 4) Create client user's link entry (self-owned path)
  try {
    const linkId = chatId; // reuse deterministic chatId
    const userLinkRef = doc(db, "users", userId, "sites", "cc", "links", linkId);
    const linkPayload: ClientLink = {
      linkId,
      ownerId,
      userId,
      clientId,
      clientDisplayName,
      clientRef,
      createdAt: serverTimestamp() as unknown as Timestamp,
    };
    await setDoc(userLinkRef, linkPayload, { merge: true });
  } catch {
    throw new Error("PERM_LINK_SET");
  }

  // 5) Mark invite used (allowed by invite rules for accepting user)
  try {
    await updateDoc(inviteRef, {
      status: "used" as InviteStatus,
      usedAt: serverTimestamp(),
      usedBy: userId,
    });
  } catch {
    throw new Error("PERM_INVITE_UPDATE");
  }

  return { chatId, clientId, clientDisplayName };
}

/**
 * Send a chat message (participant-only).
 */
export async function sendChatMessage(params: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<void> {
  const { chatId, senderId, text } = params;
  if (!text.trim()) return;
  const msgCol = collection(db, "chats", chatId, "messages");
  await addDoc(msgCol, {
    senderId,
    text,
    createdAt: serverTimestamp(),
  });
  // Update chat lastMessageAt (idempotent)
  const chatRef = doc(db, "chats", chatId);
  await setDoc(
    chatRef,
    { lastMessageAt: serverTimestamp() },
    { merge: true }
  );

  // Also mirror lastMessageAt onto per-user chat summaries so UIs can compute "unread"
  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data() as { ownerId?: string; userId?: string };
      const ownerId = data.ownerId;
      const clientUserId = data.userId;

      // Owner's per-user summary (participants are allowed to update owner's summary by rules)
      if (ownerId) {
        try {
          await setDoc(
            doc(db, "users", ownerId, "sites", "cc", "chats", chatId),
            { chatId, ownerId, ...(clientUserId ? { userId: clientUserId } : {}), lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {
          // ignore — owner summary mirror is best-effort
        }
      }

      // Client/self per-user summary (self-owned path)
      if (clientUserId) {
        try {
          await setDoc(
            doc(db, "users", clientUserId, "sites", "cc", "chats", chatId),
            { lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {
          // ignore — client summary mirror is best-effort
        }
      }
    }
  } catch {
    // ignore mirror failures
  }
}

/**
 * Send a highlighted "Update" to the chat (participant-only).
 * Renders as a professional alert on the client side.
 */
export async function sendChatUpdate(params: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<void> {
  const { chatId, senderId, text } = params;
  if (!text.trim()) return;
  const msgCol = collection(db, "chats", chatId, "messages");
  await addDoc(msgCol, {
    senderId,
    text,
    kind: "update",
    createdAt: serverTimestamp(),
  });
  const chatRef = doc(db, "chats", chatId);
  await setDoc(
    chatRef,
    {
      lastMessageAt: serverTimestamp(),
      lastUpdateAt: serverTimestamp(),
    },
    { merge: true }
  );

  // Mirror lastMessageAt to per-user chat summaries (owner + client)
  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data() as { ownerId?: string; userId?: string };
      const ownerId = data.ownerId;
      const clientUserId = data.userId;

      if (ownerId) {
        try {
          await setDoc(
            doc(db, "users", ownerId, "sites", "cc", "chats", chatId),
            { chatId, ownerId, ...(clientUserId ? { userId: clientUserId } : {}), lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {}
      }
      if (clientUserId) {
        try {
          await setDoc(
            doc(db, "users", clientUserId, "sites", "cc", "chats", chatId),
            { lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {}
      }
    }
  } catch {
    // ignore mirror failures
  }
}

/**
 * Helper: check if current user already has a summary for this chat.
 */
export async function hasChatSummary(userId: string, chatId: string): Promise<boolean> {
  const ref = doc(db, "users", userId, "sites", "cc", "chats", chatId);
  const snap = await getDoc(ref);
  return snap.exists();
}

/**
 * Helper: find chatId by (ownerId, clientId, userId) if already created.
 */
export async function findExistingChatId(ownerId: string, clientId: string, userId: string): Promise<string | null> {
  const chatId = deterministicChatId(ownerId, clientId, userId);
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  return snap.exists() ? chatId : null;
}

/**
 * Owner-side: ensure mirrored summary/link entries exist for a given link.
 * Idempotent: safe to call multiple times.
 */
export async function ensureOwnerMirrorsForLink(params: {
  ownerId: string;
  clientId: string;
  clientDisplayName: string;
  userId: string;
  clientRef?: string;
}): Promise<{ chatId: string }> {
  const { ownerId, clientId, clientDisplayName, userId } = params;
  const clientRef = params.clientRef ?? `/users/${ownerId}/sites/zzq/clients/${clientId}`;

  // Ensure canonical chat exists without preliminary GET (avoid rules denial on non-existent doc)
  const chatId = deterministicChatId(ownerId, clientId, userId);
  const chatRef = doc(db, "chats", chatId);
  await setDoc(
    chatRef,
    {
      ownerId,
      userId,
      clientId,
      clientRef,
      participants: [ownerId, userId],
    } as Partial<ChatDoc>,
    { merge: true }
  );

  // Owner's per-user chat summary
  const ownerChatRef = doc(db, "users", ownerId, "sites", "cc", "chats", chatId);
  await setDoc(
    ownerChatRef,
    {
      chatId,
      ownerId,
      userId,
      clientId,
      clientDisplayName,
      createdAt: serverTimestamp(),
      lastMessageAt: null,
    } as ChatSummary,
    { merge: true }
  );

  // Owner-facing link entry under the client
  const ownerLinkRef = doc(
    db,
    "users",
    ownerId,
    "sites",
    "zzq",
    "clients",
    clientId,
    "links",
    chatId
  );
  await setDoc(
    ownerLinkRef,
    {
      linkId: chatId,
      ownerId,
      userId,
      clientId,
      clientDisplayName,
      clientRef,
      createdAt: serverTimestamp(),
    } as ClientLink,
    { merge: true }
  );

  return { chatId };
}

/**
 * Convenience: ensure owner mirrors are present given a used invite doc.
 */
export async function ensureOwnerMirrorsForUsedInvite(invite: InviteDoc): Promise<{ chatId: string }> {
  if (!invite.usedBy) throw new Error("Invite has no usedBy");
  return ensureOwnerMirrorsForLink({
    ownerId: invite.ownerId,
    clientId: invite.clientId,
    clientDisplayName: invite.clientDisplayName,
    userId: invite.usedBy,
    clientRef: invite.clientRef,
  });
}

/**
 * Revoke an active invite (owner-only).
 */
export async function revokeInvite(params: { ownerId: string; token: string }): Promise<void> {
  const { ownerId, token } = params;
  const ref = doc(db, "users", ownerId, "sites", "zzq", "invites", token);
  await updateDoc(ref, { status: "revoked" as InviteStatus });
}

/**
 * Unlink a client user from an owner's client:
 * - Remove the client user from chat participants (owner remains)
 * - Delete per-user chat summaries and link mirrors for both sides
 * - Keep canonical chat for audit with owner as remaining participant
 */
export async function unlinkLinkedUser(params: {
  ownerId: string;
  clientId: string;
  userId: string; // linked user's uid
}): Promise<{ chatId: string }> {
  const { ownerId, clientId, userId } = params;
  const chatId = deterministicChatId(ownerId, clientId, userId);

  // 1) Update canonical chat participants (remove client user, keep owner)
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (snap.exists()) {
    const data = snap.data() as ChatDoc;
    const participants = Array.from(new Set((data.participants || []).filter((p) => p !== userId)));
    await setDoc(chatRef, { participants }, { merge: true });
  }

  // 2) Remove per-user chat summaries and link mirrors
  const paths = [
    ["users", userId, "sites", "cc", "chats", chatId], // client user's dashboard summary
    ["users", userId, "sites", "cc", "links", chatId], // client user's link mirror
    ["users", ownerId, "sites", "cc", "chats", chatId], // owner's dashboard summary
    ["users", ownerId, "sites", "zzq", "clients", clientId, "links", chatId], // owner-facing link entry
  ] as const;

  for (const p of paths) {
    try {
      // Use single-path form to avoid TS overload ambiguity with spread const tuples
      const ref = doc(db, p.join("/"));
      await deleteDoc(ref);
    } catch {
      // best-effort deletions; ignore missing docs
    }
  }

  return { chatId };
}