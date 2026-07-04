"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/types";
import type { SeatDataSale } from "@/lib/types";
import FullDataView from "./FullDataView";

type DateWindow = 7 | 30 | 90 | "all";

const C = {
  amber: "#ffb43d", violet: "#b06cff", teal: "#4dd6c4",
  hot: "#ff5d8f", muted: "#9c96b3",
};

const tooltipStyle = {
  backgroundColor: "#0d0b16",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "10px",
  color: "#f4f1f7",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: "12px",
};

const money = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", maximumFractionDigits: 0,
}).format(value);
const number = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value));
const compact = (value: number) => new Intl.NumberFormat("en-US", {
  notation: "compact", maximumFractionDigits: 1,
}).format(value);
const dateLabel = (value: string) => new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

function Kpi({ label, value, note, color }: {
  label: string; value: string; note: string; color: string;
}) {
  return (
    <article className="overflow-hidden rounded-xl border border-white/10 bg-[#1b1830] p-4 shadow-[0_16px_45px_rgba(0,0,0,.16)]">
      <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">{label}</p>
      <p className="mt-2 font-mono text-[clamp(1.35rem,2.4vw,1.85rem)] font-bold leading-none" style={{ color }}>{value}</p>
      <p className="mt-4 border-t border-dashed border-white/10 pt-3 font-mono text-[10px] text-[#9c96b3]">{note}</p>
    </article>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-[14px] border border-white/10 bg-[#1b1830] p-4 shadow-[0_18px_50px_rgba(0,0,0,.15)] sm:p-[18px]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-sm font-bold tracking-[.02em]">{title}</h2>
        {hint && <p className="text-[11px] text-[#9c96b3]">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function TicketHeader({ eventId }: { eventId?: string }) {
  const bars = [2, 4, 1, 3, 2, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2];
  return (
    <header className="mx-auto max-w-[1180px] px-[22px] pt-[26px]">
      <div className="relative flex overflow-hidden rounded-[14px] border border-white/10 bg-[linear-gradient(120deg,#241f3d,#1a1730)] shadow-[0_24px_70px_rgba(0,0,0,.24)]">
        <i className="absolute -left-[11px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-[#12101c]" />
        <i className="absolute -right-[11px] top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full bg-[#12101c]" />
        <div className="min-w-0 flex-1 px-6 py-[22px] sm:px-[26px]">
          <p className="text-[10px] font-bold uppercase tracking-[.32em] text-[#ffb43d] sm:text-[11px]">Private market data · Box office report</p>
          <h1 className="mt-2 font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-[clamp(2rem,6vw,3.65rem)] uppercase leading-[.96] tracking-wide">
            SeatData <span className="text-[#b06cff]">Resale Analytics</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[13px] text-[#9c96b3]">Aggregate sales intelligence without exposing private transaction records to the browser.</p>
        </div>
        <div className="hidden w-[126px] shrink-0 flex-col items-center justify-center gap-2 border-l-2 border-dashed border-white/10 bg-black/15 p-3 sm:flex">
          <span className="text-[9px] uppercase tracking-[.18em] text-[#9c96b3]">Event</span>
          <div className="flex h-11 items-stretch gap-[2px]" aria-hidden="true">
            {bars.map((width, i) => <i key={i} className="block bg-[#f4f1f7]/85" style={{ width }} />)}
          </div>
          <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-[#9c96b3]">{eventId ?? "Admit one"}</span>
        </div>
      </div>
    </header>
  );
}

export default function DashboardPage() {
  const [eventId, setEventId] = useState("1120934");
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [window, setWindow] = useState<DateWindow>("all");
  const [zones, setZones] = useState<Set<string>>(new Set());
  const [view, setView] = useState<"public" | "full">("full");
  const [rawSales, setRawSales] = useState<SeatDataSale[]>([]);
  const [rawEventId, setRawEventId] = useState("");
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState("");
  const [rawAttempt, setRawAttempt] = useState(0);

  useEffect(() => {
    if (view !== "full" || !data || rawEventId === data.eventId) return;
    setRawLoading(true);
    setRawError("");
    const controller = new AbortController();
    fetch("/api/dashboard/event/" + encodeURIComponent(data.eventId) + "/raw", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not load raw data.");
        if (!Array.isArray(result)) throw new Error("Raw data response was not an array.");
        setRawSales(result);
        setRawEventId(data.eventId);
      })
      .catch((error) => {
        if (error instanceof Error && error.name !== "AbortError") setRawError(error.message);
      })
      .finally(() => setRawLoading(false));
    return () => controller.abort();
  }, [view, data, rawEventId, rawAttempt]);

  function openFullView() {
    setView("full");
    if (data && rawEventId !== data.eventId) setRawAttempt((current) => current + 1);
  }

  const daily = useMemo(() => {
    const rows = data?.charts.salesOverTime ?? [];
    if (window === "all" || !rows.length) return rows;
    const latest = new Date(`${rows.at(-1)?.date}T00:00:00Z`).getTime();
    const cutoff = latest - (window - 1) * 86_400_000;
    return rows.filter((row) => new Date(`${row.date}T00:00:00Z`).getTime() >= cutoff);
  }, [data, window]);

  const zoneRows = useMemo(() => {
    const rows = data?.charts.salesByZone ?? [];
    return zones.size ? rows.filter((row) => zones.has(row.zone)) : rows;
  }, [data, zones]);

  const period = useMemo(() => {
    const tickets = daily.reduce((sum, row) => sum + row.ticketsSold, 0);
    const gross = daily.reduce((sum, row) => sum + row.grossSales, 0);
    return { tickets, gross, average: tickets ? gross / tickets : 0 };
  }, [daily]);

  const windowLabel = window === "all" ? "all imported dates" : `last ${window} days`;

  function toggleZone(zone: string) {
    setZones((current) => {
      if (!current.size) return new Set([zone]);
      const next = new Set(current);
      if (next.has(zone)) next.delete(zone); else next.add(zone);
      return next;
    });
  }

  function resetFilters() { setWindow("all"); setZones(new Set()); }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    globalThis.location.assign("/login");
  }

  async function importEvent() {
    const id = eventId.trim();
    if (!id) { setStatus("Enter a SeatData event ID first."); return; }
    setLoading(true); setStatus("Importing from SeatData...");
    try {
      const response = await fetch("/api/import/seatdata", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: id }),
      });
      const result = await response.json();
      if (!response.ok) { setStatus(result.error ?? "Import failed."); return; }
      setStatus(`Imported ${result.recordsStored} private records. Loading aggregates...`);
      await loadDashboard(id);
    } catch { setStatus("Import failed because of a network or server error."); }
    finally { setLoading(false); }
  }

  async function loadDashboard(id = eventId.trim()) {
    if (!id) { setStatus("Enter a SeatData event ID first."); return; }
    setLoading(true); setStatus("Loading aggregate dashboard data...");
    try {
      const response = await fetch(`/api/dashboard/event/${encodeURIComponent(id)}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) { setStatus(result.error ?? "Could not load dashboard data."); setData(null); return; }
      setData(result); setRawSales([]); setRawEventId(""); setView("full"); resetFilters(); setStatus("Dashboard loaded.");
    } catch { setStatus("Dashboard failed to load."); setData(null); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-[#12101c] pb-20 text-[#f4f1f7] [background-image:radial-gradient(1200px_500px_at_78%_-8%,rgba(176,108,255,.16),transparent_60%),radial-gradient(900px_420px_at_6%_4%,rgba(255,180,61,.10),transparent_55%)]">
      <TicketHeader eventId={data?.eventId} />
      <div className="mx-auto max-w-[1180px] space-y-4 px-[22px] pt-5">
        <section className="grid gap-4 rounded-[14px] border border-white/10 bg-[#1b1830] p-4 sm:p-[18px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex min-w-0 flex-1 flex-col gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">SeatData event ID</span>
              <input
                value={eventId}
                onChange={(event) => setEventId(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter" && !loading) void importEvent(); }}
                placeholder="Example: 1120943"
                className="w-full rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2.5 font-mono text-sm outline-none transition placeholder:text-[#716b86] focus:border-[#b06cff]"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <button onClick={importEvent} disabled={loading} className="rounded-lg border border-[#ffb43d] bg-[#ffb43d] px-4 py-2.5 text-xs font-bold text-[#241800] transition hover:bg-[#ffc35f] disabled:cursor-not-allowed disabled:opacity-50">
                {loading ? "Working..." : "Import / Refresh"}
              </button>
              <button onClick={() => loadDashboard()} disabled={loading} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-[#9c96b3] transition hover:border-[#4dd6c4] hover:text-white disabled:opacity-50">
                Load cached
              </button>
              <button onClick={logout} className="rounded-lg border border-white/10 px-4 py-2.5 text-xs font-semibold text-[#9c96b3] transition hover:border-[#ff5d8f] hover:text-white">
                Sign out
              </button>
            </div>
          </div>
          {status && (
            <p role="status" className="border-t border-dashed border-white/10 pt-3 font-mono text-[11px] text-[#9c96b3]">
              <i className="mr-2 inline-block h-2 w-2 rounded-full bg-[#4dd6c4]" />{status}
            </p>
          )}
        </section>

        {data && (
          <nav className="flex overflow-hidden rounded-[14px] border border-white/10 bg-[#1b1830] p-1" aria-label="Dashboard data views">
            <button onClick={() => setView("public")} className={"flex-1 rounded-[10px] px-4 py-2.5 text-xs font-bold uppercase tracking-[.14em] transition " + (view === "public" ? "bg-[#b06cff] text-[#160f24]" : "text-[#9c96b3] hover:text-white")}>Public view</button>
            <button onClick={openFullView} className={"flex-1 rounded-[10px] px-4 py-2.5 text-xs font-bold uppercase tracking-[.14em] transition " + (view === "full" ? "bg-[#ffb43d] text-[#241800]" : "text-[#9c96b3] hover:text-white")}>Full data view</button>
          </nav>
        )}

        {data && view === "full" ? (
          rawLoading ? (
            <section className="rounded-[14px] border border-white/10 bg-[#1b1830] px-6 py-16 text-center font-mono text-sm text-[#9c96b3]">Loading authenticated raw data…</section>
          ) : rawError ? (
            <section className="rounded-[14px] border border-[#ff5d8f]/40 bg-[#1b1830] px-6 py-12 text-center"><p className="text-[#ff5d8f]">{rawError}</p><button onClick={openFullView} className="mt-4 rounded-lg border border-white/10 px-3 py-2 text-xs text-[#9c96b3]">Retry</button></section>
          ) : rawEventId === data.eventId ? (
            <FullDataView rawSales={rawSales} />
          ) : null
        ) : data ? (
          <>
            <section className="grid gap-4 rounded-[14px] border border-white/10 bg-[#1b1830] p-4 sm:p-[18px]">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">Zones · controls zone views</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button onClick={() => setZones(new Set())} className={`rounded-full border px-3 py-1 text-xs transition ${!zones.size ? "border-[#b06cff] bg-[#b06cff] font-semibold text-[#160f24]" : "border-white/10 text-[#9c96b3] hover:border-[#b06cff] hover:text-white"}`}>All zones</button>
                    {data.charts.salesByZone.map((zone) => (
                      <button key={zone.zone} onClick={() => toggleZone(zone.zone)} className={`rounded-full border px-3 py-1 text-xs transition ${zones.has(zone.zone) ? "border-[#b06cff] bg-[#b06cff] font-semibold text-[#160f24]" : "border-white/10 text-[#9c96b3] hover:border-[#b06cff] hover:text-white"}`}>{zone.zone}</button>
                    ))}
                  </div>
                </div>
                <div className="shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">Window · controls daily views</p>
                  <div className="mt-2 inline-flex overflow-hidden rounded-lg border border-white/10">
                    {([7, 30, 90, "all"] as DateWindow[]).map((value) => (
                      <button key={value} onClick={() => setWindow(value)} className={`border-r border-white/10 px-3 py-1.5 text-[11px] last:border-r-0 ${window === value ? "bg-[#221d3a] font-bold text-[#ffb43d]" : "text-[#9c96b3] hover:text-white"}`}>{value === "all" ? "All" : `${value}d`}</button>
                    ))}
                  </div>
                </div>
                <button onClick={resetFilters} className="self-start rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9c96b3] transition hover:border-[#ffb43d] hover:text-white xl:mt-[26px]">Reset filters</button>
              </div>
            </section>

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <Kpi label="Tickets sold" value={number(period.tickets)} note={windowLabel} color={C.violet} />
              <Kpi label="Gross sales" value={money(period.gross)} note="estimated · before fees" color={C.amber} />
              <Kpi label="Average price" value={money(period.average)} note={`${windowLabel} · per ticket`} color={C.teal} />
              <Kpi label="Median price" value={money(data.summary.medianPrice)} note="all imported data · per ticket" color={C.hot} />
              <Kpi label="Transactions" value={number(data.summary.transactionCount)} note="aggregate count · rows stay private" color="#f4f1f7" />
            </section>

            <div className="grid gap-4 lg:grid-cols-[1.62fr_1fr]">
              <Panel title="Historical sales data" hint="bars: tickets sold · line: average price">
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={daily}>
                      <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} minTickGap={24} />
                      <YAxis yAxisId="tickets" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} />
                      <YAxis yAxisId="price" orientation="right" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${compact(value)}`} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                      <Bar yAxisId="tickets" dataKey="ticketsSold" name="Tickets sold" fill={C.violet} radius={[3, 3, 0, 0]} />
                      <Line yAxisId="price" type="linear" dataKey="averagePrice" name="Average price" stroke={C.teal} strokeWidth={2.5} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap gap-3 font-mono text-[10px] text-[#9c96b3]">
                  <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#b06cff]" />Tickets sold</span>
                  <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#4dd6c4]" />Average $/ticket</span>
                </div>
              </Panel>

              <Panel title="Average price by zone" hint="aggregate zone data">
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneRows.slice(0, 10)} layout="vertical" margin={{ left: 6, right: 18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                      <XAxis type="number" tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(value) => `$${compact(value)}`} />
                      <YAxis type="category" dataKey="zone" width={92} tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                      <Bar dataKey="averagePrice" name="Average price" fill={C.amber} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.62fr_1fr]">
              <Panel title="Daily aggregate ledger" hint={`${daily.length} days · no transaction rows exposed`}>
                <div className="mt-4 max-h-[390px] overflow-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-[#1b1830]">
                      <tr className="text-[10px] uppercase tracking-[.1em] text-[#9c96b3]">
                        <th className="border-b border-white/10 px-2 py-2 font-semibold">Date</th>
                        <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Tickets</th>
                        <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Average</th>
                        <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Gross</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[...daily].reverse().map((row) => (
                        <tr key={row.date} className="hover:bg-white/[.03]">
                          <td className="border-b border-white/[.045] px-2 py-2">{dateLabel(row.date)}</td>
                          <td className="border-b border-white/[.045] px-2 py-2 text-right text-[#b06cff]">{number(row.ticketsSold)}</td>
                          <td className="border-b border-white/[.045] px-2 py-2 text-right text-[#4dd6c4]">{money(row.averagePrice)}</td>
                          <td className="border-b border-white/[.045] px-2 py-2 text-right text-[#ffb43d]">{money(row.grossSales)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>

              <Panel title="Price distribution" hint="tickets per price band">
                <div className="mt-4 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.charts.priceBuckets}>
                      <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                      <XAxis dataKey="bucket" tick={{ fill: C.muted, fontSize: 9 }} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} interval={0} angle={-25} textAnchor="end" height={58} />
                      <YAxis tick={{ fill: C.muted, fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={compact} />
                      <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                      <Bar dataKey="ticketsSold" name="Tickets sold" fill={C.violet} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <Panel title="Zone performance · aggregate explorer" hint={`${zoneRows.length} zones · sorted by tickets sold`}>
              <p className="mt-1 text-[11px] text-[#9c96b3]">
                This replaces the template&apos;s raw-row explorer. Section, row, and individual transaction details remain in private backend storage.
              </p>
              <div className="mt-4 max-h-[460px] overflow-auto border-t border-white/10">
                <table className="w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-[#1b1830]">
                    <tr className="text-[10px] uppercase tracking-[.1em] text-[#9c96b3]">
                      <th className="border-b border-white/10 px-3 py-2 font-semibold">Zone</th>
                      <th className="border-b border-white/10 px-3 py-2 text-right font-semibold">Tickets sold</th>
                      <th className="border-b border-white/10 px-3 py-2 text-right font-semibold">Average price</th>
                      <th className="border-b border-white/10 px-3 py-2 text-right font-semibold">Gross sales</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {zoneRows.map((row) => (
                      <tr key={row.zone} className="hover:bg-white/[.03]">
                        <td className="border-b border-white/[.045] px-3 py-2">
                          <span className="rounded-full bg-[#221d3a] px-2 py-1 font-sans text-[10px] text-[#b06cff]">{row.zone}</span>
                        </td>
                        <td className="border-b border-white/[.045] px-3 py-2 text-right">{number(row.ticketsSold)}</td>
                        <td className="border-b border-white/[.045] px-3 py-2 text-right text-[#4dd6c4]">{money(row.averagePrice)}</td>
                        <td className="border-b border-white/[.045] px-3 py-2 text-right text-[#ffb43d]">{money(row.grossSales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <footer className="pt-5 text-center font-mono text-[10px] leading-6 text-[#9c96b3]">
              <span className="text-[#ffb43d]">Private-data boundary:</span>{" "}
              raw SeatData records stay in private Blob storage. This page receives summary, daily, zone, and price-bucket aggregates only.
              <br />Event {data.eventId} · generated {new Date(data.generatedAt).toLocaleString()}
            </footer>
          </>
        ) : (
          <section className="rounded-[14px] border border-dashed border-white/10 bg-[#1b1830]/70 px-6 py-14 text-center">
            <p className="font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-3xl uppercase tracking-wide text-[#b06cff]">Admit one event</p>
            <p className="mx-auto mt-3 max-w-xl text-sm text-[#9c96b3]">Enter a SeatData event ID to import fresh private records, or load an event already cached in private storage.</p>
          </section>
        )}
      </div>
    </main>
  );
}
