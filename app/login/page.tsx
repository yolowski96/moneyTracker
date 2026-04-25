import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { AuthError } from "next-auth";
import { log } from "@/lib/log";
import { LoginForm } from "./form";

type PageProps = {
  searchParams: Promise<{ from?: string; error?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { from, error } = await searchParams;
  const redirectTo = from && from.startsWith("/") && !from.startsWith("/login") ? from : "/";

  async function login(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const to = String(formData.get("redirectTo") ?? "/");

    if (!email || !password) {
      redirect(`/login?error=missing&from=${encodeURIComponent(to)}`);
    }

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: to,
      });
    } catch (err) {
      if (err instanceof AuthError) {
        log("action.login", 401, err.type, "signIn failed", { email });
        redirect(`/login?error=invalid&from=${encodeURIComponent(to)}`);
      }
      throw err;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Bankopolis</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Sign in to your account.
        </p>
      </header>

      <LoginForm action={login} redirectTo={redirectTo} error={error ?? null} />

      <p className="mt-6 text-center text-sm text-[color:var(--muted)]">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="underline hover:text-[color:var(--foreground)]">
          Create one
        </Link>
      </p>
    </main>
  );
}
