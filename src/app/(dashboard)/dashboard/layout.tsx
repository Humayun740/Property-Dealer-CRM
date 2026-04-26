import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/auth";
import LogoutButton from "@/components/LogoutButton";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-xs uppercase text-slate-500">Property Dealer CRM</p>
            <h1 className="text-lg font-semibold text-slate-900">Welcome, {user.name}</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
            >
              Dashboard
            </Link>
            <Link
              href="/dashboard/leads"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800"
            >
              Leads
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
