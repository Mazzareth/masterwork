// Visibility toggles for main page buttons (UI-level)
// Set to false to hide a given entry regardless of permissions.
export const pageVisibility = {
  zzq: true,
  cc: true,
  inhouse: true,
} as const;

export type PageKey = keyof typeof pageVisibility;

export const PAGE_LABELS: Record<PageKey, string> = {
  zzq: "ZZQ",
  cc: "CC",
  inhouse: "InHouse",
};