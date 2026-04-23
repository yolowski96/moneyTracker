-- Partial index covering the two "pending" (uncategorized) queries that run
-- on every home render and the inbox page:
--   * prisma.transaction.count({ where: { category: null } })
--   * prisma.transaction.findMany({ where: { category: null }, orderBy: { occurredAt: "desc" } })
--
-- Without this, both force a sequential scan of every transaction row.
-- With the partial index, Postgres only touches the rows with category IS NULL
-- and reads them already sorted by occurredAt DESC.
--
-- Kept as a partial index (rather than a plain composite on (category,
-- occurredAt)) because the great majority of rows eventually get a category,
-- so the index stays small.
CREATE INDEX "Transaction_pending_occurredAt_idx"
  ON "Transaction" ("occurredAt" DESC)
  WHERE "category" IS NULL;
