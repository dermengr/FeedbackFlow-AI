import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NotificationPrefs } from "@/components/NotificationPrefs";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session || !session.user.id) {
    return <div className="p-8 text-slate-500">Please sign in.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">
          Manage notification preferences and account options.
        </p>
      </div>
      <NotificationPrefs />
    </div>
  );
}