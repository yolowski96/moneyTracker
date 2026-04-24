-- Settings: locale + currency
ALTER TABLE "Settings" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Settings" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

-- User-managed categories
CREATE TABLE "Category" (
  "id"        TEXT NOT NULL,
  "label"     TEXT NOT NULL,
  "emoji"     TEXT NOT NULL,
  "position"  INTEGER NOT NULL DEFAULT 0,
  "archived"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Category_archived_position_idx" ON "Category"("archived", "position");

-- Seed defaults so existing transactions keep their category strings working.
-- IDs match the prior hardcoded constants in lib/categories.ts.
INSERT INTO "Category" ("id", "label", "emoji", "position") VALUES
  ('food',          'Food',          E'\U0001F35C', 0),
  ('groceries',     'Groceries',     E'\U0001F6D2', 1),
  ('coffee',        'Coffee',        E'\u2615',      2),
  ('transport',     'Transport',     E'\U0001F695', 3),
  ('fuel',          'Fuel',          E'\u26FD',      4),
  ('rent',          'Rent',          E'\U0001F3E0', 5),
  ('utilities',     'Utilities',     E'\U0001F4A1', 6),
  ('entertainment', 'Fun',           E'\U0001F3AC', 7),
  ('clothes',       'Clothes',       E'\U0001F455', 8),
  ('health',        'Health',        E'\U0001FA7A', 9),
  ('travel',        'Travel',        E'\u2708\uFE0F', 10),
  ('gifts',         'Gifts',         E'\U0001F381', 11),
  ('education',     'Education',     E'\U0001F4DA', 12),
  ('subscriptions', 'Subs',          E'\U0001F9FE', 13),
  ('drinks',        'Drinks',        E'\U0001F37B', 14),
  ('other',         'Other',         E'\U0001F4E6', 15);
