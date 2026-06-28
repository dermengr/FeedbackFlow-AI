"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { MessageSquareWarning, Loader2, ArrowRight } from "lucide-react";
import { AuthDivider, GoogleSignInButton } from "@/components/GoogleSignInButton";

const DEMO_PASSWORD = "password123";

const DEMO_ACCOUNTS = [
  { email: "admin@feedbackflow.dev", role: "Admin" },
  { email: "manager@feedbackflow.dev", role: "Manager" },
  { email: "analyst@feedbackflow.dev", role: "Analyst" },
  { email: "support@feedbackflow.dev", role: "Support Agent" },
  { email: "viewer@feedbackflow.dev", role: "Viewer" },
  { email: "developer@feedbackflow.dev", role: "Developer" },
  { email: "qa@feedbackflow.dev", role: "QA Engineer" },
  { email: "product@feedbackflow.dev", role: "Product Owner" },
  { email: "marketing@feedbackflow.dev", role: "Marketing" },
  { email: "sales@feedbackflow.dev", role: "Sales" },
];

const smoothEase = [0.25, 0.46, 0.45, 0.94] as const;

const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: smoothEase, staggerChildren: 0.05 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: smoothEase } },
};

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function signInAs(accountEmail: string) {
    setEmail(accountEmail);
    setPassword(DEMO_PASSWORD);
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email: accountEmail,
      password: DEMO_PASSWORD,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError(`Could not sign in as ${accountEmail}.`);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <motion.div
      className="w-full max-w-md"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <motion.div
        variants={itemVariants}
        className="mb-6 flex items-center justify-center gap-2"
      >
        <motion.span
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow"
          whileHover={{ scale: 1.05, rotate: 3 }}
          transition={{ duration: 0.2 }}
        >
          <MessageSquareWarning className="h-6 w-6" />
        </motion.span>
        <span className="text-xl font-bold tracking-tight">
          <span className="gradient-text">FeedbackFlow</span> AI
        </span>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white/90 p-6 shadow-soft backdrop-blur-sm dark:bg-slate-800/90 dark:border-slate-700/70"
      >
        <motion.h1
          variants={itemVariants}
          className="text-xl font-semibold text-slate-900 dark:text-slate-100"
        >
          Sign in
        </motion.h1>
        <motion.p
          variants={itemVariants}
          className="mt-1 text-sm text-slate-500 dark:text-slate-400"
        >
          Access your feedback dashboard.
        </motion.p>

        <motion.div variants={itemVariants} className="mt-5">
          <GoogleSignInButton callbackUrl={callbackUrl} label="Sign in with Google" />
        </motion.div>
        <AuthDivider />

        <motion.form variants={itemVariants} onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-modern mt-1"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-modern mt-1"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
            >
              {error}
            </motion.p>
          )}

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="btn-primary w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in…
              </>
            ) : (
              <>
                Sign in
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </motion.button>
        </motion.form>

        <motion.p variants={itemVariants} className="mt-4 text-center text-sm text-slate-500 dark:text-slate-400">
          No account?{" "}
          <Link href="/signup" className="font-medium text-brand-600 hover:text-brand-700 transition-colors dark:text-brand-400 dark:hover:text-brand-300">
            Sign up
          </Link>
        </motion.p>
      </motion.div>

      <motion.div
        variants={itemVariants}
        className="mt-5 rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-soft backdrop-blur-sm dark:bg-slate-800/80 dark:border-slate-700/70"
      >
        <p className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Demo accounts — password: {DEMO_PASSWORD}
        </p>
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.03 } },
          }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-3"
        >
          {DEMO_ACCOUNTS.map((account) => (
            <motion.button
              key={account.email}
              variants={itemVariants}
              type="button"
              disabled={loading}
              onClick={() => signInAs(account.email)}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-xl border border-slate-200 bg-slate-50/80 px-2 py-2 text-left transition-colors hover:bg-white hover:border-brand-200 hover:shadow-sm disabled:opacity-60 dark:bg-slate-700/50 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{account.role}</span>
              <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400">{account.email}</span>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
