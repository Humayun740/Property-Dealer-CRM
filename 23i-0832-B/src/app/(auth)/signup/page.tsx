"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.error || "Signup failed");
      setLoading(false);
      return;
    }

    setMessage(data.message || "Account created. Please login.");
    setTimeout(() => {
      router.push("/login");
    }, 1000);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Signup</h1>
        <p className="mt-1 text-sm text-slate-600">
          First signup becomes Admin, all next users become Agents.
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-md border border-slate-300 px-3 py-2"
          />

          {error && <p className="text-sm text-rose-700">{error}</p>}
          {message && <p className="text-sm text-emerald-700">{message}</p>}

          <button
            disabled={loading}
            className="w-full rounded-md bg-emerald-700 px-4 py-2 text-white hover:bg-emerald-800 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-600">
          Already have an account? <Link href="/login" className="text-emerald-700">Login</Link>
        </p>
      </section>
    </main>
  );
}
