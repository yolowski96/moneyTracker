import { cache } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import { userCategoriesTag } from "./cache-tags";

export type Category = {
  id: string;
  label: string;
  emoji: string;
  position: number;
  archived: boolean;
};

async function getAllForUser(userId: string): Promise<Category[]> {
  const fn = unstable_cache(
    async (uid: string): Promise<Category[]> => {
      const rows = await prisma.category.findMany({
        where: { userId: uid },
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
    ["categories:all:v2", userId],
    { tags: [userCategoriesTag(userId)] },
  );
  return fn(userId);
}

export const getAllCategories = cache(async (userId: string): Promise<Category[]> => {
  return getAllForUser(userId);
});

export const getActiveCategories = cache(async (userId: string): Promise<Category[]> => {
  const all = await getAllForUser(userId);
  return all.filter((c) => !c.archived);
});

// Lookup-by-id helper. Falls back to stored id if category was deleted/archived
// after a transaction was filed under it. Scoped to the owner.
export async function getCategory(
  userId: string,
  id: string | null | undefined,
): Promise<Category | null> {
  if (!id) return null;
  const all = await getAllForUser(userId);
  return all.find((c) => c.id === id) ?? null;
}
