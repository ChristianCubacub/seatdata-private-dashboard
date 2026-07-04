"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Login failed.");
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const destination =
        requested?.startsWith("/") && !requested.startsWith("//")
          ? requested
          : "/dashboard";
      window.location.assign(destination);
    } catch {
      setError("Could not reach the login service.");
    } finally {
      setLoading(false);
    }
  }

  const bars = [2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2];

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#12101c] px-5 py-10 text-[#f4f1f7] [background-image:radial-gradient(900px_520px_at_78%_0%,rgba(176,108,255,.2),transparent_62%),radial-gradient(760px_460px_at_8%_100%,rgba(255,180,61,.12),transparent_58%)]">
      <div className="w-full max-w-[920px]">
        <div className="relative grid overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(125deg,#241f3d,#171428)] shadow-[0_35px_100px_rgba(0,0,0,.5)] md:grid-cols-[1.1fr_.9fr]">
          <i className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#12101c]" />
          <i className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-[#12101c]" />

          <section className="relative flex min-h-[390px] flex-col justify-between border-b-2 border-dashed border-white/10 p-8 md:border-b-0 md:border-r-2 md:p-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.32em] text-[#ffb43d]">
                Private admission · Authorized users only
              </p>
              <h1 className="mt-5 font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(3rem,8vw,5.5rem)] uppercase leading-[.84] tracking-wide">
                Box Office
                <span className="mt-2 block text-[#b06cff]">Intelligence</span>
              </h1>
              <p className="mt-6 max-w-md text-sm leading-6 text-[#9c96b3]">
                Sign in to access private SeatData imports, aggregate market
                views, and the authenticated raw-data explorer.
              </p>
            </div>

            <div className="mt-10 flex items-end justify-between gap-5">
              <div>
                <p className="text-[9px] uppercase tracking-[.18em] text-[#9c96b3]">
                  Access level
                </p>
                <p className="mt-1 font-mono text-xs text-[#4dd6c4]">
                  PRIVATE / FULL DATA
                </p>
              </div>
              <div className="flex h-12 items-stretch gap-[2px]" aria-hidden="true">
                {bars.map((width, index) => (
                  <i
                    key={index}
                    className="block bg-[#f4f1f7]/80"
                    style={{ width }}
                  />
                ))}
              </div>
            </div>
          </section>

          <section className="flex flex-col justify-center bg-black/10 p-8 md:p-10">
            <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#9c96b3]">
              Admit one
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Dashboard sign in</h2>
            <p className="mt-2 text-xs text-[#9c96b3]">
              Use your private dashboard credentials.
            </p>

            <form onSubmit={submit} className="mt-7 space-y-4">
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9c96b3]">
                  Username
                </span>
                <input
                  autoComplete="username"
                  autoFocus
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="mt-2 w-full rounded-[10px] border border-white/10 bg-[#12101c]/70 px-4 py-3 font-mono text-sm outline-none transition placeholder:text-[#5f5972] focus:border-[#b06cff] focus:ring-2 focus:ring-[#b06cff]/15"
                  placeholder="dashboard user"
                />
              </label>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9c96b3]">
                  Password
                </span>
                <span className="relative mt-2 block">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-[10px] border border-white/10 bg-[#12101c]/70 px-4 py-3 pr-16 font-mono text-sm outline-none transition placeholder:text-[#5f5972] focus:border-[#b06cff] focus:ring-2 focus:ring-[#b06cff]/15"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-wider text-[#9c96b3] hover:text-white"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
              </label>

              {error && (
                <p role="alert" className="rounded-lg border border-[#ff5d8f]/30 bg-[#ff5d8f]/10 px-3 py-2.5 text-xs text-[#ff8fb2]">
                  {error}
                </p>
              )}

              <button
                disabled={loading}
                className="w-full rounded-[10px] border border-[#ffb43d] bg-[#ffb43d] px-4 py-3 text-xs font-bold uppercase tracking-[.14em] text-[#241800] transition hover:bg-[#ffc35f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Verifying ticket…" : "Enter dashboard"}
              </button>
            </form>

            <p className="mt-5 text-center font-mono text-[9px] leading-4 text-[#716b86]">
              Session expires after 12 hours · Credentials are never stored in
              browser JavaScript
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
