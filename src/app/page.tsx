import Link from "next/link";

export default function Home() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-10 text-white">
      <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-600/30 blur-3xl" />
      <div className="absolute -right-20 bottom-4 h-72 w-72 rounded-full bg-cyan-500/20 blur-3xl" />

      <main className="relative z-10 w-full max-w-3xl rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">CS-4032 Assignment</p>
        <h1 className="mt-3 text-4xl font-bold leading-tight">
          Property Dealer CRM
        </h1>
        <p className="mt-4 max-w-2xl text-slate-200">
          Full-stack CRM using Next.js App Router, MongoDB,
          JWT authentication, RBAC, and lead management with scoring.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-white/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10"
          >
            Signup
          </Link>
        </div>
      </main>
    </div>
  );
}
