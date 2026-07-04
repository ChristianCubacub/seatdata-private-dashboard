"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { DashboardData, SeatDataEventSearchResult, SeatDataSale } from "@/lib/types";
import FullDataView from "./FullDataView";
import Panel from "./Panel";

type DateWindow = 7 | 30 | 90 | "all";

const RECENT_EVENTS_KEY = "seatdata_recent_events";
const RECENT_EVENTS_LIMIT = 8;

type RecentEvent = {
  eventId: string;
  eventName: string;
  venueName: string;
  venueCity: string;
  venueState: string;
  eventDate: string;
};

function loadRecentEvents(): RecentEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_EVENTS_KEY);
    return raw ? (JSON.parse(raw) as RecentEvent[]) : [];
  } catch {
    return [];
  }
}

function saveRecentEvents(events: RecentEvent[]) {
  try {
    window.localStorage.setItem(RECENT_EVENTS_KEY, JSON.stringify(events));
  } catch {
    // localStorage may be unavailable (e.g. private browsing); safe to ignore.
  }
}

const C = {
  amber: "#ffb43d", violet: "#b06cff", teal: "#4dd6c4",
  hot: "#ff5d8f", muted: "#9c96b3",
};

const tooltipStyle = (maximized: boolean) => ({
  backgroundColor: "#0d0b16",
  border: "1px solid rgba(255,255,255,.12)",
  borderRadius: "10px",
  color: "#f4f1f7",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  fontSize: maximized ? "16px" : "12px",
});
const axisTick = (maximized: boolean, size: number) => ({ fill: C.muted, fontSize: maximized ? size + 5 : size });

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
const timeLabel = (value?: string) => {
  if (!value) return "—";
  const [hoursText, minutesText] = value.split(":");
  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return value;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${period}`;
};
const locationLabel = (city: string, state: string) => (state ? `${city}, ${state}` : city);

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
  const [recentEvents, setRecentEvents] = useState<RecentEvent[]>([]);
  const [searchName, setSearchName] = useState("");
  const [searchVenue, setSearchVenue] = useState("");
  const [searchCity, setSearchCity] = useState("");
  const [searchState, setSearchState] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [searchHistorical, setSearchHistorical] = useState(false);
  const [searchResults, setSearchResults] = useState<SeatDataEventSearchResult[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchAttempted, setSearchAttempted] = useState(false);

  useEffect(() => { setRecentEvents(loadRecentEvents()); }, []);

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

  function rememberRecentEvent(result: SeatDataEventSearchResult) {
    const entry: RecentEvent = {
      eventId: String(result.event_id),
      eventName: result.event_name,
      venueName: result.venue_name,
      venueCity: result.venue_city,
      venueState: result.venue_state,
      eventDate: result.event_date,
    };
    setRecentEvents((current) => {
      const next = [entry, ...current.filter((item) => item.eventId !== entry.eventId)].slice(0, RECENT_EVENTS_LIMIT);
      saveRecentEvents(next);
      return next;
    });
  }

  async function runSearch(cursor: string | null = null) {
    setSearchLoading(true); setSearchError(""); setSearchAttempted(true);
    try {
      const params = new URLSearchParams();
      if (searchName.trim()) params.set("event_name", searchName.trim());
      if (searchVenue.trim()) params.set("venue_name", searchVenue.trim());
      if (searchCity.trim()) params.set("venue_city", searchCity.trim());
      if (searchState.trim()) params.set("venue_state", searchState.trim());
      if (searchDate.trim()) params.set("event_date", searchDate.trim());
      if (searchHistorical) params.set("historical", "true");
      params.set("limit", "25");
      if (cursor) params.set("starting_after", cursor);

      const response = await fetch(`/api/events/search?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Search failed.");

      setSearchResults((current) => (cursor ? [...current, ...result.data] : result.data));
      setSearchHasMore(Boolean(result.has_more));
      setSearchCursor(result.next_cursor ?? null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  function selectSearchResult(result: SeatDataEventSearchResult) {
    const id = String(result.event_id);
    setEventId(id);
    rememberRecentEvent(result);
    void importEvent(id);
  }

  function selectRecentEvent(entry: RecentEvent) {
    setEventId(entry.eventId);
    void importEvent(entry.eventId);
  }

  async function importEvent(id = eventId.trim()) {
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
              <button onClick={() => void importEvent()} disabled={loading} className="rounded-lg border border-[#ffb43d] bg-[#ffb43d] px-4 py-2.5 text-xs font-bold text-[#241800] transition hover:bg-[#ffc35f] disabled:cursor-not-allowed disabled:opacity-50">
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
                {(maximized) => (
                  <>
                    <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={daily}>
                          <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                          <XAxis dataKey="date" tick={axisTick(maximized, 10)} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} minTickGap={24} />
                          <YAxis yAxisId="tickets" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={compact} />
                          <YAxis yAxisId="price" orientation="right" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => `$${compact(value)}`} />
                          <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                          <Bar yAxisId="tickets" dataKey="ticketsSold" name="Tickets sold" fill={C.violet} radius={[3, 3, 0, 0]} activeBar={false} />
                          <Line yAxisId="price" type="linear" dataKey="averagePrice" name="Average price" stroke={C.teal} strokeWidth={2.5} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className={`mt-2 flex flex-wrap gap-3 font-mono text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>
                      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#b06cff]" />Tickets sold</span>
                      <span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-[#4dd6c4]" />Average $/ticket</span>
                    </div>
                  </>
                )}
              </Panel>

              <Panel title="Average price by zone" hint="aggregate zone data">
                {(maximized) => (
                  <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zoneRows.slice(0, 10)} layout="vertical" margin={{ left: 6, right: 18 }}>
                        <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                        <XAxis type="number" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => `$${compact(value)}`} />
                        <YAxis type="category" dataKey="zone" width={maximized ? 130 : 92} tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                        <Bar dataKey="averagePrice" name="Average price" fill={C.amber} radius={[0, 4, 4, 0]} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.62fr_1fr]">
              <Panel title="Daily aggregate ledger" hint={`${daily.length} days · no transaction rows exposed`}>
                {(maximized) => (
                  <div className={maximized ? "mt-4 max-h-[75vh] overflow-auto" : "mt-4 max-h-[390px] overflow-auto"}>
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-[#1b1830]">
                        <tr className={`uppercase tracking-[.1em] text-[#9c96b3] ${maximized ? "text-base" : "text-[10px]"}`}>
                          <th className="border-b border-white/10 px-2 py-2 font-semibold">Date</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Tickets</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Average</th>
                          <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Gross</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        {[...daily].reverse().map((row) => (
                          <tr key={row.date} className="hover:bg-white/[.03]">
                            <td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{dateLabel(row.date)}</td>
                            <td className={`border-b border-white/[.045] px-2 py-2 text-right text-[#b06cff] ${maximized ? "text-lg" : "text-xs"}`}>{number(row.ticketsSold)}</td>
                            <td className={`border-b border-white/[.045] px-2 py-2 text-right text-[#4dd6c4] ${maximized ? "text-lg" : "text-xs"}`}>{money(row.averagePrice)}</td>
                            <td className={`border-b border-white/[.045] px-2 py-2 text-right text-[#ffb43d] ${maximized ? "text-lg" : "text-xs"}`}>{money(row.grossSales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel title="Price distribution" hint="tickets per price band">
                {(maximized) => (
                  <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.priceBuckets}>
                        <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                        <XAxis dataKey="bucket" tick={axisTick(maximized, 9)} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} interval={0} angle={-25} textAnchor="end" height={58} />
                        <YAxis tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={compact} />
                        <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                        <Bar dataKey="ticketsSold" name="Tickets sold" fill={C.violet} radius={[4, 4, 0, 0]} activeBar={false} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Panel>
            </div>

            <Panel title="Zone performance · aggregate explorer" hint={`${zoneRows.length} zones · sorted by tickets sold`}>
              {(maximized) => (
                <>
                  <p className={`mt-1 text-[#9c96b3] ${maximized ? "text-sm" : "text-[11px]"}`}>
                    This replaces the template&apos;s raw-row explorer. Section, row, and individual transaction details remain in private backend storage.
                  </p>
                  <div className={(maximized ? "mt-4 max-h-[75vh] overflow-auto" : "mt-4 max-h-[460px] overflow-auto") + " border-t border-white/10"}>
                    <table className="w-full border-collapse text-left">
                      <thead className="sticky top-0 z-10 bg-[#1b1830]">
                        <tr className={`uppercase tracking-[.1em] text-[#9c96b3] ${maximized ? "text-base" : "text-[10px]"}`}>
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
                              <span className={`rounded-full bg-[#221d3a] px-2 py-1 font-sans text-[#b06cff] ${maximized ? "text-base" : "text-[10px]"}`}>{row.zone}</span>
                            </td>
                            <td className={`border-b border-white/[.045] px-3 py-2 text-right ${maximized ? "text-lg" : "text-xs"}`}>{number(row.ticketsSold)}</td>
                            <td className={`border-b border-white/[.045] px-3 py-2 text-right text-[#4dd6c4] ${maximized ? "text-lg" : "text-xs"}`}>{money(row.averagePrice)}</td>
                            <td className={`border-b border-white/[.045] px-3 py-2 text-right text-[#ffb43d] ${maximized ? "text-lg" : "text-xs"}`}>{money(row.grossSales)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </Panel>

            <footer className="pt-5 text-center font-mono text-[10px] leading-6 text-[#9c96b3]">
              <span className="text-[#ffb43d]">Private-data boundary:</span>{" "}
              raw SeatData records stay in private Blob storage. This page receives summary, daily, zone, and price-bucket aggregates only.
              <br />Event {data.eventId} · generated {new Date(data.generatedAt).toLocaleString()}
            </footer>
          </>
        ) : (
          <>
            <section className="rounded-[14px] border border-white/10 bg-[#1b1830] p-4 sm:p-[18px]">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">Search SeatData events</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  value={searchName}
                  onChange={(event) => setSearchName(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !searchLoading) void runSearch(); }}
                  placeholder="Event name"
                  className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff] lg:col-span-2"
                />
                <input
                  value={searchVenue}
                  onChange={(event) => setSearchVenue(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !searchLoading) void runSearch(); }}
                  placeholder="Venue"
                  className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]"
                />
                <input
                  value={searchCity}
                  onChange={(event) => setSearchCity(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !searchLoading) void runSearch(); }}
                  placeholder="City"
                  className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]"
                />
                <input
                  value={searchState}
                  onChange={(event) => setSearchState(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !searchLoading) void runSearch(); }}
                  placeholder="State"
                  className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <input
                  value={searchDate}
                  onChange={(event) => setSearchDate(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter" && !searchLoading) void runSearch(); }}
                  placeholder="Date (e.g. 2026 or 2026-07)"
                  className="w-56 rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]"
                />
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#9c96b3]">
                  <input type="checkbox" checked={searchHistorical} onChange={(event) => setSearchHistorical(event.target.checked)} className="h-4 w-4 accent-[#4dd6c4]" />
                  Include past events
                </label>
                <button onClick={() => void runSearch()} disabled={searchLoading} className="ml-auto rounded-lg border border-[#ffb43d] bg-[#ffb43d] px-4 py-2 text-xs font-bold text-[#241800] transition hover:bg-[#ffc35f] disabled:cursor-not-allowed disabled:opacity-50">
                  {searchLoading ? "Searching..." : "Search events"}
                </button>
              </div>
              {searchError && <p className="mt-3 border-t border-dashed border-white/10 pt-3 font-mono text-[11px] text-[#ff5d8f]">{searchError}</p>}
            </section>

            {searchAttempted && (
              <Panel title="Search results" hint={searchResults.length ? `${searchResults.length} event${searchResults.length === 1 ? "" : "s"} · click a row to import` : undefined}>
                {searchResults.length ? (
                  <>
                    <div className="mt-4 max-h-[440px] overflow-auto">
                      <table className="w-full border-collapse text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-[#1b1830]">
                          <tr className="text-[10px] uppercase tracking-[.1em] text-[#9c96b3]">
                            <th className="border-b border-white/10 px-2 py-2 font-semibold">Name</th>
                            <th className="border-b border-white/10 px-2 py-2 font-semibold">Date</th>
                            <th className="border-b border-white/10 px-2 py-2 font-semibold">Time</th>
                            <th className="border-b border-white/10 px-2 py-2 font-semibold">Venue</th>
                            <th className="border-b border-white/10 px-2 py-2 font-semibold">Location</th>
                            <th className="border-b border-white/10 px-2 py-2 text-right font-semibold">Days tracked</th>
                          </tr>
                        </thead>
                        <tbody className="font-mono">
                          {searchResults.map((result) => (
                            <tr key={result.event_id} onClick={() => selectSearchResult(result)} className="cursor-pointer hover:bg-white/[.03]">
                              <td className="border-b border-white/[.045] px-2 py-2 font-sans text-[#f4f1f7]">{result.event_name}</td>
                              <td className="whitespace-nowrap border-b border-white/[.045] px-2 py-2">{dateLabel(result.event_date)}</td>
                              <td className="whitespace-nowrap border-b border-white/[.045] px-2 py-2">{timeLabel(result.event_time)}</td>
                              <td className="border-b border-white/[.045] px-2 py-2 font-sans">{result.venue_name}</td>
                              <td className="whitespace-nowrap border-b border-white/[.045] px-2 py-2 font-sans">{locationLabel(result.venue_city, result.venue_state)}</td>
                              <td className="border-b border-white/[.045] px-2 py-2 text-right">{result.days_on_seatdata ?? "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {searchHasMore && (
                      <button onClick={() => void runSearch(searchCursor)} disabled={searchLoading} className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9c96b3] transition hover:border-[#4dd6c4] hover:text-white disabled:opacity-50">
                        {searchLoading ? "Loading..." : "Load more"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-3 text-sm text-[#9c96b3]">No events matched that search.</p>
                )}
              </Panel>
            )}

            {recentEvents.length > 0 && (
              <Panel title="Recently viewed" hint="click to reload">
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentEvents.map((entry) => (
                    <button key={entry.eventId} onClick={() => selectRecentEvent(entry)} className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-left text-xs transition hover:border-[#b06cff]">
                      <span className="block font-semibold text-[#f4f1f7]">{entry.eventName}</span>
                      <span className="mt-0.5 block text-[10px] text-[#9c96b3]">{entry.venueName} · {locationLabel(entry.venueCity, entry.venueState)}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            )}

            <section className="rounded-[14px] border border-dashed border-white/10 bg-[#1b1830]/70 px-6 py-14 text-center">
              <p className="font-[Impact,Haettenschweiler,'Arial_Narrow_Bold',sans-serif] text-3xl uppercase tracking-wide text-[#b06cff]">Admit one event</p>
              <p className="mx-auto mt-3 max-w-xl text-sm text-[#9c96b3]">Search for an event above, pick a recent one, or enter a SeatData event ID directly.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
