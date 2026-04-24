import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { TAG_CATEGORIES } from "./cache-tags";

export type Category = {
  id: string;
  label: string;
  emoji: string;
  position: number;
  archived: boolean;
};

const getAllCategoriesCached = unstable_cache(
  async (): Promise<Category[]> => {
    const rows = await prisma.category.findMany({
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
    });
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      emoji: r.emoji,
      position: r.position,
      archived: r.archived,
    }));
  },
  ["categories:all:v1"],
  { tags: [TAG_CATEGORIES] },
);

export const getAllCategories = cache(async (): Promise<Category[]> => {
  return getAllCategoriesCached();
});

export const getActiveCategories = cache(async (): Promise<Category[]> => {
  const all = await getAllCategoriesCached();
  return all.filter((c) => !c.archived);
});

// Lookup-by-id helper. Falls back to stored id if category was deleted/archived
// after a transaction was filed under it.
export async function getCategory(
  id: string | null | undefined,
): Promise<Category | null> {
  if (!id) return null;
  const all = await getAllCategoriesCached();
  return all.find((c) => c.id === id) ?? null;
}
