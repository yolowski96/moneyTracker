"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidateTag } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { generateApiToken } from "@/lib/auth";
import { DEMO_EMAIL } from "@/lib/demo";
import { seedDemoData, seedDemoSnapshots } from "@/lib/demo-seed";
import { materializeSurplus } from "@/lib/savings";
import { getSettings } from "@/lib/cycle";
import { log } from "@/lib/log";
import {
  userTxnTag,
  userIncomeTag,
  userSettingsTag,
  userCategoriesTag,
  userRecurringTag,
  userGoalsTag,
  userSavingsTag,
  userNetWorthTag,
} from "@/lib/cache-tags";

// Demo entry: upsert the demo user, wipe + re-seed its data, sign in.
// Gated on DEMO_PASSWORD (spec:
// docs/superpowers/specs/2026-07-02-demo-mode-design.md).
export async function enterDemo() {
  const password = process.env.DEMO_PASSWORD;
  if (!password) redirect("/login");

  // Origin for the self-referencing mock portfolio URL.
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  // passwordHash refreshed every entry so rotating DEMO_PASSWORD just works;
  // apiToken kept stable so an already-rendered portfolio page stays valid.
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash },
    create: {
      email: DEMO_EMAIL,
      passwordHash,
      name: "Demo",
      apiToken: generateApiToken(),
    },
  });
  if (!user.apiToken) {
    await prisma.user.update({
      where: { id: user.id },
      data: { apiToken: generateApiToken() },
    });
  }

  // Wipe + seed atomically: a failure rolls back to the previous demo state.
  await prisma.$transaction(async (tx) => {
    await tx.transaction.deleteMany({ where: { userId: user.id } });
    await tx.incomeEvent.deleteMany({ where: { userId: user.id } });
    await tx.savingsAccount.deleteMany({ where: { userId: user.id } }); // cascades SavingsEntry
    await tx.netWorthSnapshot.deleteMany({ where: { userId: user.id } });
    await tx.recurringRule.deleteMany({ where: { userId: user.id } });
    await tx.goal.deleteMany({ where: { userId: user.id } });
    await tx.category.deleteMany({ where: { userId: user.id } });
    await tx.settings.deleteMany({ where: { userId: user.id } });
    await seedDemoData(tx, user.id, origin);
  });

  // Every cached read for this user is now stale.
  const tags = [
    userTxnTag,
    userIncomeTag,
    userSettingsTag,
    userCategoriesTag,
    userRecurringTag,
    userGoalsTag,
    userSavingsTag,
    userNetWorthTag,
  ];
  for (const tag of tags) revalidateTag(tag(user.id), "max");

  // Let the real materializer post the historical surpluses, then derive
  // net-worth history from what it actually posted.
  const settings = await getSettings(user.id);
  await materializeSurplus(user.id, settings);
  await seedDemoSnapshots(user.id, settings);
  revalidateTag(userSavingsTag(user.id), "max");
  revalidateTag(userNetWorthTag(user.id), "max");

  log("action.demo", 200, "seeded", `demo reset for user ${user.id}`, { userId: user.id });

  await signIn("credentials", { email: DEMO_EMAIL, password, redirectTo: "/" });
}
