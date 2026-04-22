export type Category = {
  id: string;
  label: string;
  emoji: string;
};

export const CATEGORIES: Category[] = [
  { id: "food", label: "Food", emoji: "\u{1F35C}" },
  { id: "groceries", label: "Groceries", emoji: "\u{1F6D2}" },
  { id: "coffee", label: "Coffee", emoji: "\u2615" },
  { id: "transport", label: "Transport", emoji: "\u{1F695}" },
  { id: "fuel", label: "Fuel", emoji: "\u26FD" },
  { id: "rent", label: "Rent", emoji: "\u{1F3E0}" },
  { id: "utilities", label: "Utilities", emoji: "\u{1F4A1}" },
  { id: "entertainment", label: "Fun", emoji: "\u{1F3AC}" },
  { id: "clothes", label: "Clothes", emoji: "\u{1F455}" },
  { id: "health", label: "Health", emoji: "\u{1FA7A}" },
  { id: "travel", label: "Travel", emoji: "\u2708\uFE0F" },
  { id: "gifts", label: "Gifts", emoji: "\u{1F381}" },
  { id: "education", label: "Education", emoji: "\u{1F4DA}" },
  { id: "subscriptions", label: "Subs", emoji: "\u{1F9FE}" },
  { id: "drinks", label: "Drinks", emoji: "\u{1F37B}" },
  { id: "other", label: "Other", emoji: "\u{1F4E6}" },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string | null | undefined): Category | null {
  if (!id) return null;
  return BY_ID.get(id) ?? null;
}

export function formatCategoryLabel(id: string | null | undefined): string {
  const c = getCategory(id);
  if (!c) return id ?? "";
  return `${c.emoji} ${c.label}`;
}
