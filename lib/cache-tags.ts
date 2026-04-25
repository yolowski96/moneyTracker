// Single source of truth for Next.js data-cache tag names.
// Use these with unstable_cache({ tags: [...] }) and revalidateTag(...).
//
// Global tags still exist for clarity; prefer per-user tags so a mutation
// for user A doesn't blow away user B's cached entries.
export const TAG_SETTINGS = "settings";
export const TAG_TRANSACTIONS = "transactions";
export const TAG_INCOME_EVENTS = "income-events";
export const TAG_CATEGORIES = "categories";

export function userTxnTag(userId: string): string {
  return `transactions:${userId}`;
}

export function userIncomeTag(userId: string): string {
  return `income-events:${userId}`;
}

export function userSettingsTag(userId: string): string {
  return `settings:${userId}`;
}

export function userCategoriesTag(userId: string): string {
  return `categories:${userId}`;
}
