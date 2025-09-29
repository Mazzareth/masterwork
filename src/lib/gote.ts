import { db } from "./firebase";
import { addDoc, collection, doc, getDoc, serverTimestamp, setDoc, Timestamp, updateDoc } from "firebase/firestore";

export type GoteInviteStatus = "active" | "expired" | "used" | "revoked";

export type GoteInviteDoc = {
  token: string;
  ownerId: string;
  chatId?: string;
  title?: string | null;
  note?: string | null;
  scene?: string | null;
  aiDndEnabled?: boolean;
  createdAt?: Timestamp;
  expiresAt?: Timestamp | null;
  usedAt?: Timestamp | null;
  usedBy?: string | null;
  status: GoteInviteStatus;
};

export type GoteChatDoc = {
  participants: string[]; // [ownerId, userId]
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp | null;
  lastUpdateAt?: Timestamp | null;
  aiDndEnabled?: boolean;
  sharedPin?: string | null;
  scene?: string | null;
  aiBehavior?: string | null;
  enjoyment?: Record<string, number>; // { [uid]: 0-100 }
};

export type GoteChatSummary = {
  chatId: string;
  createdAt?: Timestamp;
  lastMessageAt?: Timestamp | null;
  lastReadAt?: Timestamp | null;
  otherUserId?: string | null;
  title?: string | null;
};

// Base64url encoder for Uint8Array (shared with linking utils)
function base64url(bytes: Uint8Array): string {
  const bin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  // Browser or Node-safe
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
 * Deterministic chat id for (ownerId, userId).
 * Uses a simple stable 32-bit FNV-1a hash, hex-encoded.
 */
export function deterministicGoteChatId(ownerId: string, userId: string): string {
  const s = `${ownerId}:${userId}`;
  let h = 0x811c9dc5; // 32-bit FNV-1a
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  const hex = ("00000000" + h.toString(16)).slice(-8);
  return `g_${hex}`;
}

export function defaultInviteExpiry(days = 7): Timestamp {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return Timestamp.fromDate(d);
}

/**
 * Owner-only: create an invite under `/users/{ownerId}/sites/gote/invites/{token}`.
 */
export async function createGoteInvite(params: {
  ownerId: string;
  expiresAt?: Timestamp;
  title?: string | null;
  note?: string | null;
  aiDndEnabled?: boolean;
  scene?: string | null;
}): Promise<{ token: string; url: string; chatId: string }> {
  const { ownerId, title = null, note = null, aiDndEnabled = false, scene = null } = params;
  const token = secureRandomToken(16);
  const expiresAt = params.expiresAt ?? defaultInviteExpiry(7);
  const chatId = `g_${token}`;

  const ref = doc(db, "users", ownerId, "sites", "gote", "invites", token);
  const payload: GoteInviteDoc = {
    token,
    ownerId,
    chatId,
    title,
    note,
    scene,
    aiDndEnabled,
    createdAt: serverTimestamp() as unknown as Timestamp,
    expiresAt,
    status: "active",
    usedAt: null,
    usedBy: null,
  };
  await setDoc(ref, payload);

  // Create owner-facing chat summary immediately so it appears in the list
  try {
    await setDoc(
      doc(db, "users", ownerId, "sites", "gote", "chats", chatId),
      {
        chatId,
        title,
        createdAt: serverTimestamp() as unknown as Timestamp,
        lastMessageAt: serverTimestamp() as unknown as Timestamp,
      } as Partial<GoteChatSummary>,
      { merge: true }
    );
  } catch {
    // owner path write should be allowed; ignore if offline
  }

  const base = typeof window !== "undefined" ? window.location.origin : "https://app.masterwork.app";
  const url = `${base}/gote/link?ownerId=${encodeURIComponent(ownerId)}&token=${encodeURIComponent(token)}`;
  return { token, url, chatId };
}

export function isGoteInviteUsable(inv: GoteInviteDoc | undefined | null): { ok: boolean; reason?: string } {
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
 * - canonical chat `/goteChats/{chatId}`
 * - user chat summary `/users/{userId}/sites/gote/chats/{chatId}`
 * - owner chat summary `/users/{ownerId}/sites/gote/chats/{chatId}` (best-effort; allowed by rules if participants can write owner's summary)
 * - marks invite used (usedAt, usedBy, status="used")
 */
export async function acceptGoteInvite(params: {
  ownerId: string;
  token: string;
  userId: string;
}): Promise<{ chatId: string }> {
  const { ownerId, token, userId } = params;

  // Load invite
  const inviteRef = doc(db, "users", ownerId, "sites", "gote", "invites", token);
  let invite: GoteInviteDoc | null = null;
  try {
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) throw new Error("INVITE_NOT_FOUND");
    invite = snap.data() as GoteInviteDoc;
  } catch {
    throw new Error("PERM_INVITE_GET");
  }

  const usable = isGoteInviteUsable(invite);
  if (!usable.ok) {
    throw new Error(usable.reason || "INVITE_NOT_USABLE");
  }

  const chatId = invite?.chatId || deterministicGoteChatId(ownerId, userId);

  // Ensure canonical chat
  const chatRef = doc(db, "goteChats", chatId);
  try {
    const chatPayload: Partial<GoteChatDoc> = {
      participants: [ownerId, userId],
      createdAt: serverTimestamp() as unknown as Timestamp,
      ...(invite?.aiDndEnabled !== undefined ? { aiDndEnabled: invite.aiDndEnabled } : {}),
      ...(invite?.scene !== undefined ? { scene: invite.scene ?? null } : {}),
    };
    await setDoc(chatRef, chatPayload, { merge: true });
  } catch {
    throw new Error("PERM_CHAT_CREATE");
  }

  // Create self summary
  try {
    const selfSummaryRef = doc(db, "users", userId, "sites", "gote", "chats", chatId);
    const summary: GoteChatSummary = {
      chatId,
      createdAt: serverTimestamp() as unknown as Timestamp,
      lastMessageAt: null,
      title: invite?.title ?? null,
    };
    await setDoc(selfSummaryRef, summary, { merge: true });
  } catch {
    throw new Error("PERM_SUMMARY_SET");
  }

  // Best-effort owner summary (may be allowed by rules)
  try {
    const ownerSummaryRef = doc(db, "users", ownerId, "sites", "gote", "chats", chatId);
    await setDoc(
      ownerSummaryRef,
      {
        chatId,
        createdAt: serverTimestamp(),
        lastMessageAt: null,
        otherUserId: userId,
        title: invite?.title ?? null,
      } as Partial<GoteChatSummary>,
      { merge: true }
    );
  } catch {
    // ignore
  }

  // Mark invite used
  try {
    await updateDoc(inviteRef, {
      status: "used" as GoteInviteStatus,
      usedAt: serverTimestamp(),
      usedBy: userId,
    });
  } catch {
    throw new Error("PERM_INVITE_UPDATE");
  }

  // Grant BigGote access on accept (self-owned user doc)
  try {
    // Use update semantics with a nested field path so we don't overwrite the entire permissions map.
    await updateDoc(
      doc(db, "users", userId),
      {
        ["permissions.gote"]: true,
        updatedAt: serverTimestamp() as unknown as Timestamp,
      }
    );
  } catch {
    // Fallback: create/merge if user doc doesn't exist yet (first sign-in race)
    try {
      await setDoc(
        doc(db, "users", userId),
        { permissions: { gote: true }, updatedAt: serverTimestamp() as unknown as Timestamp },
        { merge: true }
      );
    } catch {
      // ignore — permission flag is optional and owner can grant later
    }
  }

  return { chatId };
}

/**
 * Send a BigGote chat message (participant-only).
 */
export async function sendGoteChatMessage(params: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<void> {
  const { chatId, senderId, text } = params;
  if (!text.trim()) return;
  const msgCol = collection(db, "goteChats", chatId, "messages");
  await addDoc(msgCol, {
    senderId,
    text,
    createdAt: serverTimestamp(),
  });
  const chatRef = doc(db, "goteChats", chatId);
  await setDoc(chatRef, { lastMessageAt: serverTimestamp() }, { merge: true });

  // Mirror lastMessageAt to per-user chat summaries for all participants
  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data() as { participants?: string[] };
      const parts: string[] = Array.isArray(data.participants) ? data.participants : [];
      for (const uid of parts) {
        try {
          await setDoc(
            doc(db, "users", uid, "sites", "gote", "chats", chatId),
            { lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {
          // ignore best-effort mirrors
        }
      }
    }
  } catch {
    // ignore
  }
}

export async function sendGoteChatUpdate(params: {
  chatId: string;
  senderId: string;
  text: string;
}): Promise<void> {
  const { chatId, senderId, text } = params;
  if (!text.trim()) return;
  const msgCol = collection(db, "goteChats", chatId, "messages");
  await addDoc(msgCol, {
    senderId,
    text,
    kind: "update",
    createdAt: serverTimestamp(),
  });
  const chatRef = doc(db, "goteChats", chatId);
  await setDoc(
    chatRef,
    { lastMessageAt: serverTimestamp(), lastUpdateAt: serverTimestamp() },
    { merge: true }
  );

  // Mirror lastMessageAt to per-user chat summaries
  try {
    const snap = await getDoc(chatRef);
    if (snap.exists()) {
      const data = snap.data() as { participants?: string[] };
      const parts: string[] = Array.isArray(data.participants) ? data.participants : [];
      for (const uid of parts) {
        try {
          await setDoc(
            doc(db, "users", uid, "sites", "gote", "chats", chatId),
            { lastMessageAt: serverTimestamp() },
            { merge: true }
          );
        } catch {}
      }
    }
  } catch {
    // ignore
  }
}

export async function hasGoteChatSummary(userId: string, chatId: string): Promise<boolean> {
  const ref = doc(db, "users", userId, "sites", "gote", "chats", chatId);
  const snap = await getDoc(ref);
  return snap.exists();
}

/**
 * Owner-side idempotent mirrors for BigGote:
 * - Ensure canonical chat exists and includes both participants
 * - Ensure owner's per-user summary exists (so the owner sees the chat in the left list)
 */
export async function ensureOwnerGoteMirrors(params: {
  ownerId: string;
  userId: string;
  title?: string | null;
}): Promise<{ chatId: string }> {
  const { ownerId, userId, title = null } = params;
  const chatId = deterministicGoteChatId(ownerId, userId);

  // Ensure chat doc exists and participants are set
  const chatRef = doc(db, "goteChats", chatId);
  await setDoc(
    chatRef,
    { participants: [ownerId, userId] } as Partial<GoteChatDoc>,
    { merge: true }
  );

  // Owner's per-user summary (self-owned path)
  const ownerSummaryRef = doc(db, "users", ownerId, "sites", "gote", "chats", chatId);
  await setDoc(
    ownerSummaryRef,
    {
      chatId,
      createdAt: serverTimestamp(),
      lastMessageAt: null,
      otherUserId: userId,
      title,
    } as Partial<GoteChatSummary>,
    { merge: true }
  );

  return { chatId };
}

/**
 * Convenience: create owner mirrors for a used invite. Safe to call repeatedly.
 */
export async function ensureOwnerGoteMirrorsForUsedInvite(invite: GoteInviteDoc): Promise<{ chatId: string }> {
  if (!invite.usedBy) throw new Error("Invite has no usedBy");
  return ensureOwnerGoteMirrors({
    ownerId: invite.ownerId,
    userId: invite.usedBy,
    title: invite.title ?? null,
  });
}

/**
 * Per-chat, per-player inventory
 */
export type GoteInventoryItem = {
  id: string;
  name: string;
  qty?: number;
  notes?: string | null;
};

export type GoteInventoryDoc = {
  items?: GoteInventoryItem[];
  updatedAt?: Timestamp | null;
};

export type GoteInventoryOps = {
  add?: Array<{ name: string; qty?: number; notes?: string | null }>;
  remove?: Array<{ name: string; qty?: number }>;
  set?: Array<{ name: string; qty?: number; notes?: string | null }>;
};

export async function readGoteInventory(chatId: string, uid: string): Promise<GoteInventoryDoc> {
  const ref = doc(db, "goteChats", chatId, "inventories", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { items: [], updatedAt: null };
  const data = snap.data() as Partial<GoteInventoryDoc>;
  const items = Array.isArray(data.items) ? (data.items.filter(Boolean) as GoteInventoryItem[]) : [];
  return { items, updatedAt: data.updatedAt ?? null };
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Patch inventory for a target user in a given chat.
 * - set: upsert with explicit values
 * - add: increment qty or create with qty (default 1)
 * - remove: decrement by qty or remove entirely if qty omitted or falls to <= 0
 */
export async function patchGoteInventory(params: {
  chatId: string;
  targetUid: string;
  ops: GoteInventoryOps;
}): Promise<void> {
  const { chatId, targetUid, ops } = params;
  const ref = doc(db, "goteChats", chatId, "inventories", targetUid);
  const cur = await readGoteInventory(chatId, targetUid);
  const items = Array.isArray(cur.items) ? [...cur.items] : [];

  const indexByName = (nm: string) =>
    items.findIndex((it) => normalizeName(it.name) === normalizeName(nm));

  // set
  for (const s of ops.set ?? []) {
    const idx = indexByName(s.name);
    const nextItem: GoteInventoryItem = {
      id: idx >= 0 ? items[idx].id : secureRandomToken(8),
      name: s.name,
      ...(typeof s.qty === "number" ? { qty: s.qty } : {}),
      ...(s.notes !== undefined ? { notes: s.notes ?? null } : {}),
    };
    if (idx >= 0) items[idx] = { ...items[idx], ...nextItem };
    else items.push(nextItem);
  }

  // add
  for (const a of ops.add ?? []) {
    const idx = indexByName(a.name);
    const inc = typeof a.qty === "number" ? a.qty : 1;
    if (idx >= 0) {
      const prev = items[idx].qty ?? 0;
      items[idx] = {
        ...items[idx],
        qty: prev + inc,
        ...(a.notes !== undefined ? { notes: a.notes ?? null } : {}),
      };
    } else {
      items.push({
        id: secureRandomToken(8),
        name: a.name,
        qty: inc,
        ...(a.notes !== undefined ? { notes: a.notes ?? null } : {}),
      });
    }
  }

  // remove
  for (const r of ops.remove ?? []) {
    const idx = indexByName(r.name);
    if (idx >= 0) {
      const dec = typeof r.qty === "number" ? r.qty : Number.POSITIVE_INFINITY;
      const prev = items[idx].qty ?? 0;
      const nextQty = prev - dec;
      if (!Number.isFinite(dec) || nextQty <= 0) {
        items.splice(idx, 1);
      } else {
        items[idx] = { ...items[idx], qty: nextQty };
      }
    }
  }

  await setDoc(
    ref,
    { items, updatedAt: serverTimestamp() as unknown as Timestamp },
    { merge: true }
  );
}

// ------------------------------
// Characters & States (per-chat per-player)
// ------------------------------

export type GoteBuild = "Skinny" | "Slim" | "Average" | "Muscular" | "Plump";
export const GOTE_BUILD_OPTIONS: GoteBuild[] = ["Skinny", "Slim", "Average", "Muscular", "Plump"];

export type GoteHungerLevel = "Famished" | "Hungry" | "Sated" | "Full" | "Engorged";
export type GoteThirstLevel = "Parched" | "Thirsty" | "Quenched" | "Hydrated" | "Saturated";
export type GoteOxygenLevel = "Suffocating" | "Winded" | "Steady" | "Oxygenated" | "Brimming";

export const GOTE_HUNGER_LEVELS: GoteHungerLevel[] = ["Famished", "Hungry", "Sated", "Full", "Engorged"];
export const GOTE_THIRST_LEVELS: GoteThirstLevel[] = ["Parched", "Thirsty", "Quenched", "Hydrated", "Saturated"];
export const GOTE_OXYGEN_LEVELS: GoteOxygenLevel[] = ["Suffocating", "Winded", "Steady", "Oxygenated", "Brimming"];

export const GOTE_DEFAULT_LEVELS = {
  hunger: "Sated" as GoteHungerLevel,
  thirst: "Quenched" as GoteThirstLevel,
  oxygen: "Steady" as GoteOxygenLevel,
};

export type GoteCharacterProfileDoc = {
  /** Character display name (player-provided during setup) */
  name: string;
  /** Height as human-readable string (e.g., "6'1\"", "185 cm") */
  height: string;
  /** Weight as human-readable string (e.g., "180 lbs", "82 kg") */
  weight: string;
  /** Flaccid size as string with units (e.g., "3.5 in", "9 cm") */
  dickFlaccid?: string | null;
  /** Erect size as string with units (e.g., "6.5 in", "16.5 cm") */
  dickErect?: string | null;
  /** Body build selection */
  build: GoteBuild;
  /** Weaknesses (free text; e.g., "Musk") */
  weaknesses?: string | null;
  /** List of kinks (free-form tags) */
  kinks?: string[];

  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
};

export async function readGoteCharacterProfile(chatId: string, uid: string): Promise<GoteCharacterProfileDoc | null> {
  const ref = doc(db, "goteChats", chatId, "characters", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data() as Partial<GoteCharacterProfileDoc>;
  return {
    name: (data.name ?? "").toString(),
    height: (data.height ?? "").toString(),
    weight: (data.weight ?? "").toString(),
    dickFlaccid: data.dickFlaccid ?? null,
    dickErect: data.dickErect ?? null,
    build: (data.build as GoteBuild) ?? "Average",
    weaknesses: data.weaknesses ?? null,
    kinks: Array.isArray(data.kinks) ? (data.kinks.filter((s) => typeof s === "string") as string[]) : [],
    createdAt: (data.createdAt as Timestamp) ?? null,
    updatedAt: (data.updatedAt as Timestamp) ?? null,
  };
}

export async function setGoteCharacterProfile(params: {
  chatId: string;
  uid: string;
  profile: Partial<GoteCharacterProfileDoc>;
}): Promise<void> {
  const { chatId, uid, profile } = params;
  const ref = doc(db, "goteChats", chatId, "characters", uid);
  const payload: Partial<GoteCharacterProfileDoc> = {
    ...profile,
    ...(profile.kinks ? { kinks: normalizeStringList(profile.kinks) } : {}),
    ...(profile.weaknesses !== undefined ? { weaknesses: profile.weaknesses ?? null } : {}),
    updatedAt: serverTimestamp() as unknown as Timestamp,
    ...(profile.createdAt ? { createdAt: profile.createdAt } : {}),
  };
  await setDoc(ref, payload, { merge: true });
}

export type GoteCharacterStateDoc = {
  /** Status tags such as "Stunned", "Shocked" (AI/Narrator managed) */
  statusTags?: string[];
  /** Hunger level (defaults to "Sated") */
  hunger?: GoteHungerLevel;
  /** Thirst level (defaults to "Quenched") */
  thirst?: GoteThirstLevel;
  /** Oxygen level (defaults to "Steady") */
  oxygen?: GoteOxygenLevel;
  /** Clothing items currently worn (AI/Narrator managed, but may be initialized during setup) */
  clothing?: string[];
  /** Accessories such as "Muzzle", "Gag" (AI/Narrator managed) */
  accessories?: string[];

  updatedAt?: Timestamp | null;
};

export async function readGoteCharacterState(chatId: string, uid: string): Promise<GoteCharacterStateDoc> {
  const ref = doc(db, "goteChats", chatId, "states", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return {
      statusTags: [],
      hunger: GOTE_DEFAULT_LEVELS.hunger,
      thirst: GOTE_DEFAULT_LEVELS.thirst,
      oxygen: GOTE_DEFAULT_LEVELS.oxygen,
      clothing: [],
      accessories: [],
      updatedAt: null,
    };
  }
  const data = snap.data() as Partial<GoteCharacterStateDoc>;
  return {
    statusTags: Array.isArray(data.statusTags) ? (data.statusTags.filter((s) => typeof s === "string") as string[]) : [],
    hunger: (data.hunger as GoteHungerLevel) ?? GOTE_DEFAULT_LEVELS.hunger,
    thirst: (data.thirst as GoteThirstLevel) ?? GOTE_DEFAULT_LEVELS.thirst,
    oxygen: (data.oxygen as GoteOxygenLevel) ?? GOTE_DEFAULT_LEVELS.oxygen,
    clothing: Array.isArray(data.clothing) ? (data.clothing.filter((s) => typeof s === "string") as string[]) : [],
    accessories: Array.isArray(data.accessories) ? (data.accessories.filter((s) => typeof s === "string") as string[]) : [],
    updatedAt: (data.updatedAt as Timestamp) ?? null,
  };
}

export type GoteStateOps = {
  set?: Partial<Pick<GoteCharacterStateDoc, "hunger" | "thirst" | "oxygen">>;
  setStatusTags?: string[];
  addStatusTags?: string[];
  removeStatusTags?: string[];
  setClothing?: string[];
  addClothing?: string[];
  removeClothing?: string[];
  setAccessories?: string[];
  addAccessories?: string[];
  removeAccessories?: string[];
};

export async function patchGoteCharacterState(params: {
  chatId: string;
  targetUid: string;
  ops: GoteStateOps;
}): Promise<void> {
  const { chatId, targetUid, ops } = params;
  const cur = await readGoteCharacterState(chatId, targetUid);

  const next: GoteCharacterStateDoc = {
    statusTags: [...(cur.statusTags ?? [])],
    hunger: cur.hunger ?? GOTE_DEFAULT_LEVELS.hunger,
    thirst: cur.thirst ?? GOTE_DEFAULT_LEVELS.thirst,
    oxygen: cur.oxygen ?? GOTE_DEFAULT_LEVELS.oxygen,
    clothing: [...(cur.clothing ?? [])],
    accessories: [...(cur.accessories ?? [])],
  };

  if (ops.set) {
    next.hunger = ops.set.hunger ?? next.hunger;
    next.thirst = ops.set.thirst ?? next.thirst;
    next.oxygen = ops.set.oxygen ?? next.oxygen;
  }

  if (ops.setStatusTags) next.statusTags = normalizeStringList(ops.setStatusTags);
  if (ops.addStatusTags) next.statusTags = addToList(next.statusTags, ops.addStatusTags);
  if (ops.removeStatusTags) next.statusTags = removeFromList(next.statusTags, ops.removeStatusTags);

  if (ops.setClothing) next.clothing = normalizeStringList(ops.setClothing);
  if (ops.addClothing) next.clothing = addToList(next.clothing, ops.addClothing);
  if (ops.removeClothing) next.clothing = removeFromList(next.clothing, ops.removeClothing);

  if (ops.setAccessories) next.accessories = normalizeStringList(ops.setAccessories);
  if (ops.addAccessories) next.accessories = addToList(next.accessories, ops.addAccessories);
  if (ops.removeAccessories) next.accessories = removeFromList(next.accessories, ops.removeAccessories);

  const ref = doc(db, "goteChats", chatId, "states", targetUid);
  await setDoc(
    ref,
    {
      ...next,
      updatedAt: serverTimestamp() as unknown as Timestamp,
    },
    { merge: true }
  );
}

function normalizeStringList(list?: string[] | null): string[] {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of arr) {
    if (typeof raw !== "string") continue;
    const v = raw.trim();
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function addToList(existing: string[] = [], add: string[] = []): string[] {
  return normalizeStringList([...(existing ?? []), ...(add ?? [])]);
}

function removeFromList(existing: string[] = [], remove: string[] = []): string[] {
  const rm = new Set(normalizeStringList(remove).map((s) => s.toLowerCase()));
  return (existing ?? []).filter((v) => !rm.has(String(v).toLowerCase()));
}