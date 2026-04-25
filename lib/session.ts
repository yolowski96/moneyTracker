import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return id;
}

export async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function requireUser(): Promise<{ id: string; email: string | null }> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) redirect("/login");
  return { id, email: session?.user?.email ?? null };
}
