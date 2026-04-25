import Link from "next/link";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { log } from "@/lib/log";
import { RegisterForm } from "./form";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

const DEFAULT_CATEGORIES = [
  { emoji: "\u{1F37D}", label: "Food" },
  { emoji: "\u{1F6D2}", label: "Groceries" },
  { emoji: "\u{1F699}", label: "Transport" },
  { emoji: "\u{1F3E0}", label: "Home" },
  { emoji: "\u{1F3AE}", label: "Fun" },
  { emoji: "\u{1F4A1}", label: "Bills" },
];

export default async function RegisterPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  async function register(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    if (!email || !email.includes("@")) {
      redirect("/register?error=bad_email");
    }
    if (password.length < 8) {
      redirect("/register?error=weak_password");
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      redirect("/register?error=taken");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: name || null,
        settings: { create: {} },
        categories: {
          create: DEFAULT_CATEGORIES.map((c, i) => ({
            emoji: c.emoji,
            label: c.label,
            position: i + 1,
          })),
        },
      },
    });

    log("action.register", 201, "created", `user ${user.id}`, { userId: user.id, email });

    await signIn("credentials", { email, password, redirectTo: "/" });
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Bankopolis</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Create your account.
        </p>
      </header>

      <RegisterForm action={register} error={error ?? null} />

      <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
        Already have an account?{" "}
        <Link href="/login" className="underline hover:text-[color:var(--foreground)]">
          Sign in
        </Link>
      </p>
    </main>
  );
}
