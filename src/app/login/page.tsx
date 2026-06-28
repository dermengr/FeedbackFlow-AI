import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { sanitizeCallbackUrl } from "@/lib/auth-utils";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { callbackUrl?: string };
}) {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect(sanitizeCallbackUrl(searchParams.callbackUrl));
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden gradient-bg px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-1/4 -top-1/4 h-[600px] w-[600px] rounded-full bg-brand-400/10 blur-3xl animate-float" />
        <div className="absolute -right-1/4 bottom-0 h-[500px] w-[500px] rounded-full bg-brand-300/10 blur-3xl animate-float animation-delay-300" />
      </div>
      <LoginForm callbackUrl={sanitizeCallbackUrl(searchParams.callbackUrl)} />
    </div>
  );
}
