"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import type { SeatDataSale } from "@/lib/types";
import Panel from "./Panel";

type WindowValue = 1 | 3 | 14 | 30 | 90 | 180 | "all";
type Granularity = "day" | "week" | "month";
type HistogramMode = "bars" | "cdf";
type BinSize = 50 | 100 | 250 | "auto";
type TrendMode = "pct" | "usd";
type SortKey = "timestamp" | "zone" | "section" | "row" | "quantity" | "price";
type SectionView = "top10" | "top15" | "top20" | "top30" | "all" | "bottom15" | "bottomHalf";

type SaleRow = {
  timestamp: number;
  zone: string;
  section: string;
  row: string;
  quantity: number;
  price: number;
};

type HistogramPoint = {
  bucket: string;
  start: number;
  end: number;
  total: number;
  cumulative: number;
  [key: string]: string | number;
};

const COLORS = ["#ffb43d", "#b06cff", "#4dd6c4", "#ff5d8f", "#7d9cff", "#6ee787", "#ffd166", "#c792ea", "#f78c6c", "#9c96b3"];
const ZONE_COLORS: Record<string, string> = {
  Floor: "#ffb43d", Lower: "#b06cff", Upper: "#4dd6c4", Club: "#ff5d8f",
  "Club Lexus": "#7d9cff", "Corona Beach House": "#6ee787", "Club Suite": "#ffd166",
  "Loge Box": "#c792ea", Suite: "#f78c6c",
};
const zColor = (zone: string, index: number) => ZONE_COLORS[zone] ?? COLORS[index % COLORS.length];
const C = { amber: "#ffb43d", violet: "#b06cff", teal: "#4dd6c4", hot: "#ff5d8f", muted: "#9c96b3" };
const tooltipStyle = (maximized: boolean) => ({ backgroundColor: "#0d0b16", border: "1px solid rgba(255,255,255,.12)", borderRadius: "8px", color: "#f4f1f7", fontFamily: "monospace", fontSize: maximized ? "15px" : "11px" });
const axisTick = (maximized: boolean, size: number) => ({ fill: C.muted, fontSize: maximized ? size + 5 : size });

const money = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
const number = (value: number) => new Intl.NumberFormat("en-US").format(Math.round(value || 0));
const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const day = 86_400_000;
const inputDate = (time: number) => new Date(time).toISOString().slice(0, 10);
const VENUE_TIME_ZONES = [
  { value: "America/New_York", label: "Eastern" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/Denver", label: "Mountain" },
  { value: "America/Los_Angeles", label: "Pacific" },
];
const displayDate = (time: number, timeZone: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "2-digit", timeZone }).format(new Date(time));
const displayClock = (time: number, timeZone: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(time));
const displayTime = (time: number, timeZone: string) => `${displayDate(time, timeZone)} ${displayClock(time, timeZone)}`;
const zonedYMD = (time: number, timeZone: string) => {
  const map = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(time)).map((part) => [part.type, part.value])
  );
  return { year: Number(map.year), month: Number(map.month), day: Number(map.day) };
};

function Segments<T extends string | number>({ values, value, onChange, labels }: {
  values: readonly T[]; value: T; onChange: (value: T) => void; labels?: Partial<Record<T, string>>;
}) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
      {values.map((item) => (
        <button key={item} onClick={() => onChange(item)} className={`border-r border-white/10 px-2.5 py-1 text-[11px] last:border-r-0 ${value === item ? "bg-[#221d3a] font-bold text-[#ffb43d]" : "text-[#9c96b3] hover:text-white"}`}>
          {labels?.[item] ?? item}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-[#9c96b3]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
      <span className="relative h-[19px] w-[34px] shrink-0 rounded-full bg-[#2f2a45] transition-colors duration-200 peer-checked:bg-[#4dd6c4]">
        <span className="absolute left-[2px] top-[2px] h-[15px] w-[15px] rounded-full bg-white transition-transform duration-200 peer-checked:translate-x-[15px]" />
      </span>
      <span className={checked ? "text-white" : ""}>{label}</span>
    </label>
  );
}

export default function FullDataView({ rawSales }: { rawSales: SeatDataSale[] }) {
  const rows = useMemo<SaleRow[]>(() => rawSales.map((sale) => {
    const value = Number(sale.timestamp);
    return {
      timestamp: value > 1_000_000_000_000 ? value : value * 1000,
      zone: sale.zone?.trim() || "Unknown",
      section: sale.section?.trim() || "—",
      row: sale.row?.trim() || "—",
      quantity: Number(sale.quantity) || 0,
      price: Number(sale.price) || 0,
    };
  }).filter((sale) => Number.isFinite(sale.timestamp) && Number.isFinite(sale.price)), [rawSales]);

  const allZones = useMemo(() => [...new Set(rows.map((row) => row.zone))].sort(), [rows]);
  const maxTime = useMemo(() => Math.max(0, ...rows.map((row) => row.timestamp)), [rows]);
  const [zones, setZones] = useState<Set<string>>(new Set());
  const [windowValue, setWindowValue] = useState<WindowValue>("all");
  const [includeZero, setIncludeZero] = useState(true);
  const [smoothLines, setSmoothLines] = useState(false);
  const lineType = smoothLines ? "monotone" : "linear";
  const [capOutliers, setCapOutliers] = useState(true);
  const [outlierCutoff, setOutlierCutoff] = useState(3000);
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [venueTimeZone, setVenueTimeZone] = useState<string>(VENUE_TIME_ZONES[0].value);
  const [series, setSeries] = useState({ tickets: true, median: true, getIn: true });
  const [recentSort, setRecentSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "timestamp", direction: -1 });
  const [histMode, setHistMode] = useState<HistogramMode>("bars");
  const [binSize, setBinSize] = useState<BinSize>("auto");
  const [showThreshold, setShowThreshold] = useState(false);
  const [threshold, setThreshold] = useState(500);
  const [byZone, setByZone] = useState(true);
  const [isolatedZone, setIsolatedZone] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [searchZone, setSearchZone] = useState("");
  const [searchSection, setSearchSection] = useState("");
  const [searchRow, setSearchRow] = useState("");
  const [minQuantity, setMinQuantity] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [explorerSort, setExplorerSort] = useState<{ key: SortKey; direction: 1 | -1 }>({ key: "price", direction: -1 });
  const [trendMode, setTrendMode] = useState<TrendMode>("pct");
  const [trendAsOf, setTrendAsOf] = useState("");
  const [customWindow, setCustomWindow] = useState(90);
  const [trendRespectWindow, setTrendRespectWindow] = useState(false);

  const filtered = useMemo(() => rows.filter((row) => {
    if (zones.size && !zones.has(row.zone)) return false;
    if (!includeZero && row.quantity <= 0) return false;
    if (capOutliers && row.price > outlierCutoff) return false;
    if (windowValue !== "all" && row.timestamp < maxTime - windowValue * day) return false;
    return true;
  }), [rows, zones, includeZero, capOutliers, outlierCutoff, windowValue, maxTime]);

  const bucketKey = useCallback((time: number) => {
    const { year, month, day: dayOfMonth } = zonedYMD(time, venueTimeZone);
    if (granularity === "month") return `${year}-${String(month).padStart(2, "0")}-01`;
    const asUtc = new Date(Date.UTC(year, month - 1, dayOfMonth));
    if (granularity === "week") {
      asUtc.setUTCDate(asUtc.getUTCDate() - ((asUtc.getUTCDay() + 6) % 7));
      return asUtc.toISOString().slice(0, 10);
    }
    return asUtc.toISOString().slice(0, 10);
  }, [granularity, venueTimeZone]);

  const timeSeries = useMemo(() => {
    const map = new Map<string, SaleRow[]>();
    for (const row of filtered) { const key = bucketKey(row.timestamp); map.set(key, [...(map.get(key) ?? []), row]); }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, group]) => ({
      date, ticketsSold: group.reduce((sum, row) => sum + row.quantity, 0),
      medianPrice: median(group.map((row) => row.price)), getInPrice: Math.min(...group.map((row) => row.price)),
    }));
  }, [filtered, bucketKey]);

  const zoneStats = useMemo(() => allZones.map((zone) => {
    const group = filtered.filter((row) => row.zone === zone);
    const prices = group.map((row) => row.price);
    const averagePrice = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    return {
      zone,
      minPrice: prices.length ? Math.min(...prices) : 0,
      medianPrice: median(prices),
      averagePrice,
      sales: group.length,
      tickets: group.reduce((sum, row) => sum + row.quantity, 0),
    };
  }).filter((row) => row.sales), [allZones, filtered]);

  const [zoneMetric, setZoneMetric] = useState<"min" | "median" | "average">("median");
  const zoneMetricKey = zoneMetric === "min" ? "minPrice" : zoneMetric === "average" ? "averagePrice" : "medianPrice";
  const zoneMetricLabel = zoneMetric === "min" ? "Minimum" : zoneMetric === "average" ? "Average" : "Median";
  const sortedZoneStats = useMemo(
    () => [...zoneStats].sort((a, b) => a[zoneMetricKey] - b[zoneMetricKey]).slice(0, 12),
    [zoneStats, zoneMetricKey]
  );
  const maxZoneSales = Math.max(1, ...sortedZoneStats.map((entry) => entry.sales));
  const minZoneSales = sortedZoneStats.length ? Math.min(...sortedZoneStats.map((entry) => entry.sales)) : 0;

  const sectionStatsAll = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filtered) {
      map.set(row.section, (map.get(row.section) ?? 0) + row.quantity);
    }
    return [...map.entries()]
      .map(([section, quantity]) => ({ section, quantity }))
      .filter((entry) => entry.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity);
  }, [filtered]);

  const [sectionView, setSectionView] = useState<SectionView>("top10");
  const sectionStats = useMemo(() => {
    switch (sectionView) {
      case "top10": return sectionStatsAll.slice(0, 10);
      case "top15": return sectionStatsAll.slice(0, 15);
      case "top20": return sectionStatsAll.slice(0, 20);
      case "top30": return sectionStatsAll.slice(0, 30);
      case "all": return sectionStatsAll;
      case "bottom15": return sectionStatsAll.slice(-15);
      case "bottomHalf": return sectionStatsAll.slice(-Math.ceil(sectionStatsAll.length / 2));
      default: return sectionStatsAll;
    }
  }, [sectionStatsAll, sectionView]);
  const sectionViewLabel: Record<SectionView, string> = {
    top10: "top 10", top15: "top 15", top20: "top 20", top30: "top 30", all: "all",
    bottom15: "bottom 15", bottomHalf: "bottom half",
  };

  const [daysOutSeries, setDaysOutSeries] = useState({ tickets: true, getIn: true, median: true, average: false });
  const daysOutStats = useMemo(() => {
    const buckets = [
      { label: "180+ days", min: 180, max: Infinity },
      { label: "91-179 days", min: 91, max: 179 },
      { label: "61-90 days", min: 61, max: 90 },
      { label: "31-60 days", min: 31, max: 60 },
      { label: "15-30 days", min: 15, max: 30 },
      { label: "8-14 days", min: 8, max: 14 },
      { label: "4-7 days", min: 4, max: 7 },
      { label: "2-3 days", min: 2, max: 3 },
      { label: "Day of/before", min: 0, max: 1 },
    ];
    return buckets.map((bucket) => {
      const group = filtered.filter((row) => {
        const daysOut = (maxTime - row.timestamp) / day;
        return daysOut >= bucket.min && daysOut <= bucket.max;
      });
      const prices = group.map((row) => row.price);
      return {
        bucket: bucket.label,
        tickets: group.reduce((sum, row) => sum + row.quantity, 0),
        getIn: prices.length ? Math.min(...prices) : 0,
        median: median(prices),
        average: prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0,
      };
    });
  }, [filtered, maxTime]);

  const histogramZones = useMemo(() => {
    const salesByZone = new Map(zoneStats.map((entry) => [entry.zone, entry.sales]));
    return allZones
      .map((zone, index) => ({ zone, color: zColor(zone, index), sales: salesByZone.get(zone) ?? 0 }))
      .filter((entry) => entry.sales > 0);
  }, [allZones, zoneStats]);

  function toggleIsolateZone(zone: string) {
    setIsolatedZone((current) => (current === zone ? null : zone));
  }

  const summary = useMemo(() => {
    const prices = filtered.map((row) => row.price);
    const tickets = filtered.reduce((sum, row) => sum + row.quantity, 0);
    const gross = filtered.reduce((sum, row) => sum + row.quantity * row.price, 0);
    return { records: filtered.length, tickets, average: tickets ? gross / tickets : 0, median: median(prices), getIn: prices.length ? Math.min(...prices) : 0 };
  }, [filtered]);

  const histogram = useMemo(() => {
    if (!filtered.length) return [];
    const highest = Math.max(...filtered.map((row) => row.price));
    const size = binSize === "auto" ? Math.max(50, Math.ceil(highest / 10 / 50) * 50) : binSize;
    const count = Math.min(40, Math.max(1, Math.ceil(highest / size)));
    const bins: HistogramPoint[] = Array.from({ length: count }, (_, index) => {
      const start = index * size, end = start + size;
      return { bucket: "$" + number(start) + "–$" + number(end), start, end, total: 0, cumulative: 0 };
    });
    for (const row of filtered) {
      const index = Math.min(count - 1, Math.floor(row.price / size));
      bins[index].total = Number(bins[index].total) + 1;
      bins[index][row.zone] = Number(bins[index][row.zone] ?? 0) + 1;
    }
    let running = 0;
    return bins.map((bin) => {
      running += Number(bin.total);
      return { ...bin, cumulative: Math.round((running / filtered.length) * 1000) / 10 };
    });
  }, [filtered, binSize]);

  const thresholdBucket = histogram.find((bin) => threshold >= Number(bin.start) && threshold < Number(bin.end));
  const statisticBuckets = useMemo(() => {
    const prices = filtered.map((row) => row.price);
    const average = prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0;
    const find = (price: number) => histogram.find((bin) => price >= Number(bin.start) && price < Number(bin.end))?.bucket as string | undefined;
    return { average: find(average), median: find(median(prices)) };
  }, [filtered, histogram]);

  const sortRows = (items: SaleRow[], sort: { key: SortKey; direction: 1 | -1 }) => [...items].sort((a, b) => {
    const left = a[sort.key], right = b[sort.key];
    return (typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right))) * sort.direction;
  });
  const recentRows = useMemo(() => sortRows(filtered, recentSort), [filtered, recentSort]);
  const explorerRows = useMemo(() => {
    const zoneQuery = searchZone.trim().toLowerCase();
    const sectionQuery = searchSection.trim().toLowerCase();
    const rowQuery = searchRow.trim().toLowerCase();
    const minQty = minQuantity === "" ? null : Number(minQuantity);
    const maxQty = maxQuantity === "" ? null : Number(maxQuantity);
    const min = minPrice === "" ? null : Number(minPrice);
    const max = maxPrice === "" ? null : Number(maxPrice);
    return sortRows(rows.filter((row) => {
      if (zoneQuery && !row.zone.toLowerCase().includes(zoneQuery)) return false;
      if (sectionQuery && !row.section.toLowerCase().includes(sectionQuery)) return false;
      if (rowQuery && !row.row.toLowerCase().includes(rowQuery)) return false;
      if (minQty !== null && row.quantity < minQty) return false;
      if (maxQty !== null && row.quantity > maxQty) return false;
      if (min !== null && row.price < min) return false;
      if (max !== null && row.price > max) return false;
      return true;
    }), explorerSort);
  }, [rows, searchZone, searchSection, searchRow, minQuantity, maxQuantity, minPrice, maxPrice, explorerSort]);

  const trendRows = useMemo(() => {
    const base = rows.filter((row) => {
      if (zones.size && !zones.has(row.zone)) return false;
      if (!includeZero && row.quantity <= 0) return false;
      if (capOutliers && row.price > outlierCutoff) return false;
      if (trendRespectWindow && windowValue !== "all" && row.timestamp < maxTime - windowValue * day) return false;
      return true;
    });
    const anchor = trendAsOf ? new Date(`${trendAsOf}T23:59:59Z`).getTime() : maxTime;
    const metric = (values: number[], kind: "getIn" | "median" | "top") => !values.length ? 0 : kind === "getIn" ? Math.min(...values) : kind === "top" ? Math.max(...values) : median(values);
    const windows = [3, 7, 14, 30, customWindow];
    return (["getIn", "median", "top"] as const).map((kind) => ({
      kind, label: kind === "getIn" ? "Get-in" : kind === "top" ? "Top price" : "Median",
      values: windows.map((days) => {
        const current = base.filter((row) => row.timestamp > anchor - days * day && row.timestamp <= anchor).map((row) => row.price);
        const prior = base.filter((row) => row.timestamp > anchor - days * day * 2 && row.timestamp <= anchor - days * day).map((row) => row.price);
        const now = metric(current, kind), before = metric(prior, kind);
        return { days, now, before, delta: trendMode === "pct" ? (before ? ((now - before) / before) * 100 : 0) : now - before, available: current.length > 0 && prior.length > 0 };
      }),
    }));
  }, [rows, zones, includeZero, capOutliers, outlierCutoff, trendRespectWindow, windowValue, maxTime, trendAsOf, customWindow, trendMode]);

  function toggleZone(zone: string) {
    setZones((current) => {
      if (!current.size) return new Set([zone]);
      const next = new Set(current); if (next.has(zone)) next.delete(zone); else next.add(zone); return next;
    });
  }
  function toggleSort(key: SortKey, explorer = false) {
    const setter = explorer ? setExplorerSort : setRecentSort;
    setter((current) => ({ key, direction: current.key === key ? (current.direction * -1) as 1 | -1 : key === "timestamp" ? -1 : 1 }));
  }
  function reset() {
    setZones(new Set()); setWindowValue("all"); setIncludeZero(true); setSmoothLines(false); setCapOutliers(true); setOutlierCutoff(3000); setGranularity("day");
    setSeries({ tickets: true, median: true, getIn: true }); setHistMode("bars"); setBinSize("auto");
    setShowThreshold(false); setByZone(true); setShowStats(false); setTrendRespectWindow(false);
    setIsolatedZone(null);
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-4 rounded-[14px] border border-white/10 bg-[#1b1830] p-[18px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">Zones</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button onClick={() => setZones(new Set())} className={`rounded-full border px-3 py-1 text-xs ${!zones.size ? "border-[#b06cff] bg-[#b06cff] font-semibold text-[#160f24]" : "border-white/10 text-[#9c96b3]"}`}>All zones</button>
              {allZones.map((zone) => <button key={zone} onClick={() => toggleZone(zone)} className={`rounded-full border px-3 py-1 text-xs ${zones.has(zone) ? "border-[#b06cff] bg-[#b06cff] font-semibold text-[#160f24]" : "border-white/10 text-[#9c96b3] hover:border-[#b06cff] hover:text-white"}`}>{zone}</button>)}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9c96b3]">Window</p>
            <div className="mt-2"><Segments values={[1, 3, 14, 30, 90, 180, "all"] as const} value={windowValue} onChange={setWindowValue} labels={{ 1: "1d", 3: "3d", 14: "14d", 30: "30d", 90: "3mo", 180: "6mo", all: "All" }} /></div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-5 border-t border-dashed border-white/10 pt-4">
          <Toggle checked={includeZero} onChange={setIncludeZero} label="Include Qty = 0 rows" />
          <Toggle checked={smoothLines} onChange={setSmoothLines} label="Smooth graph lines" />
          <div className="flex items-center gap-2">
            <Toggle checked={capOutliers} onChange={setCapOutliers} label="Cap outliers over" />
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-[#221d3a] px-2 py-1">
              <span className="text-xs text-[#9c96b3]">$</span>
              <input
                type="number"
                min="0"
                value={outlierCutoff}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setOutlierCutoff(Number.isFinite(value) && value >= 0 ? value : 0);
                }}
                className="w-20 bg-transparent text-xs outline-none"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-[#9c96b3]">
            Venue time zone
            <select
              value={venueTimeZone}
              onChange={(event) => setVenueTimeZone(event.target.value)}
              className="rounded-lg border border-white/10 bg-[#221d3a] px-2 py-1.5 text-xs text-[#f4f1f7] outline-none focus:border-[#b06cff]"
            >
              {VENUE_TIME_ZONES.map((zone) => (
                <option key={zone.value} value={zone.value}>{zone.label}</option>
              ))}
            </select>
          </label>
          <button onClick={reset} className="ml-auto rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#9c96b3] hover:border-[#ffb43d] hover:text-white">Reset filters</button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          ["Get-in", money(summary.getIn), "lowest observed price", "#f4f1f7"],
          ["Median price", money(summary.median), "per sales row", C.hot],
          ["Average price", money(summary.average), "weighted · per ticket", C.teal],
          ["Tickets sold", number(summary.tickets), "sum of quantity", C.amber],
          ["Sales transactions", number(summary.records), "matching raw records", C.violet],
        ].map(([label, value, note, color]) => (
          <article key={label} className="rounded-xl border border-white/10 bg-[#1b1830] p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#9c96b3]">{label}</p>
            <p className="mt-2 font-mono text-[clamp(1.3rem,2.4vw,1.75rem)] font-bold leading-none" style={{ color }}>{value}</p>
            <p className="mt-4 border-t border-dashed border-white/10 pt-3 font-mono text-[10px] text-[#9c96b3]">{note}</p>
          </article>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.62fr_1fr]">
        <Panel title="Historical sales data" hint="bars: tickets sold · lines: median & cheapest get-in" controls={<Segments values={["day", "week", "month"] as const} value={granularity} onChange={setGranularity} labels={{ day: "Day", week: "Week", month: "Month" }} />}>
          {(maximized) => (
            <>
              <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timeSeries}>
                    <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                    <XAxis dataKey="date" tick={axisTick(maximized, 10)} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} minTickGap={24} />
                    <YAxis yAxisId="sales" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="price" orientation="right" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => `$${number(value)}`} />
                    <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                    {series.tickets && <Bar yAxisId="sales" dataKey="ticketsSold" name="Tickets sold" fill={C.violet} radius={[3, 3, 0, 0]} activeBar={false} />}
                    {series.median && <Line yAxisId="price" type={lineType} dataKey="medianPrice" name="Median price" stroke={C.teal} strokeWidth={2.4} dot={false} />}
                    {series.getIn && <Line yAxisId="price" type={lineType} dataKey="getInPrice" name="Get-in price" stroke={C.amber} strokeWidth={2.4} dot={false} />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <div className={`mt-2 flex flex-wrap gap-2 font-mono ${maximized ? "text-sm" : "text-[10px]"}`}>
                {(["tickets", "median", "getIn"] as const).map((key, index) => <button key={key} onClick={() => setSeries((current) => ({ ...current, [key]: !current[key] }))} className={`rounded-md border px-2 py-1 ${series[key] ? "border-white/10 text-white" : "border-transparent text-[#5f5972]"}`}><i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: [C.violet, C.teal, C.amber][index] }} />{key === "tickets" ? "Tickets sold" : key === "median" ? "Median $/tix" : "Get-in $/tix"}</button>)}
              </div>
            </>
          )}
        </Panel>

        <Panel
          title="Price by zone"
          hint={`length = ${zoneMetricLabel.toLowerCase()} · shade = sales volume`}
          controls={<Segments values={["min", "median", "average"] as const} value={zoneMetric} onChange={setZoneMetric} labels={{ min: "Min", median: "Median", average: "Average" }} />}
        >
          {(maximized) => (
            <>
              <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sortedZoneStats} layout="vertical" margin={{ left: 6, right: maximized ? 64 : 40 }}>
                    <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                    <XAxis type="number" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => `$${number(value)}`} />
                    <YAxis type="category" dataKey="zone" width={maximized ? 130 : 92} tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                    <Bar dataKey={zoneMetricKey} name={`${zoneMetricLabel} price`} radius={[0, 4, 4, 0]} activeBar={false}>
                      {sortedZoneStats.map((entry) => (
                        <Cell key={entry.zone} fill={C.amber} fillOpacity={0.35 + 0.55 * (entry.sales / maxZoneSales)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={`mt-2 flex items-center gap-2 font-mono ${maximized ? "text-sm" : "text-[10px]"}`}>
                <span className="text-[#ffb43d]">Shade = sales volume</span>
                <span className="text-[#9c96b3]">{minZoneSales}</span>
                <div
                  className="h-[9px] w-24 rounded-full border border-white/10"
                  style={{ background: "linear-gradient(90deg, rgba(255,180,61,.35), rgba(255,180,61,.9))" }}
                />
                <span className="text-[#9c96b3]">{maxZoneSales} sales</span>
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Sections by quantity"
          hint={`${sectionViewLabel[sectionView]} sections · sum of tickets sold`}
          controls={
            <div className="flex flex-col items-end gap-1.5">
              <Segments values={["top10", "top15", "top20", "top30", "all"] as const} value={sectionView} onChange={setSectionView} labels={{ top10: "Top 10", top15: "Top 15", top20: "Top 20", top30: "Top 30", all: "All" }} />
              <Segments values={["bottom15", "bottomHalf"] as const} value={sectionView} onChange={setSectionView} labels={{ bottom15: "Bottom 15", bottomHalf: "Bottom half" }} />
            </div>
          }
        >
          {(maximized) => (
            <div data-chart-fill="true" className={`mt-4 flex-1 ${maximized ? "min-h-[70vh]" : "min-h-[320px]"}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sectionStats} layout="vertical" margin={{ left: 6, right: maximized ? 64 : 40 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" horizontal={false} />
                  <XAxis type="number" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={number} />
                  <YAxis type="category" dataKey="section" width={maximized ? 130 : 92} tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                  <Bar dataKey="quantity" name="Tickets sold" fill={C.violet} radius={[0, 4, 4, 0]} activeBar={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Price distribution" hint="per ticket · threshold and stat markers" controls={<Segments values={["bars", "cdf"] as const} value={histMode} onChange={setHistMode} labels={{ bars: "Bars", cdf: "Cumulative" }} />}>
          {(maximized) => (
            <>
              <div className="mt-3" data-export-ignore="true"><Segments values={[50, 100, 250, "auto"] as const} value={binSize} onChange={setBinSize} labels={{ 50: "$50", 100: "$100", 250: "$250", auto: "Auto" }} /></div>
              <div className={maximized ? "mt-2 h-[65vh]" : "mt-2 h-[300px]"}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={histogram} margin={{ right: maximized ? 12 : 40 }}>
                    <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                    <XAxis dataKey="bucket" tick={axisTick(maximized, 9)} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} minTickGap={18} />
                    <YAxis domain={histMode === "cdf" ? [0, 100] : undefined} tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => histMode === "cdf" ? value + "%" : String(value)} />
                    <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                    {histMode === "bars" && (byZone
                      ? (isolatedZone ? [isolatedZone] : allZones).map((zone) => (
                          <Bar key={zone} dataKey={zone} name={zone} stackId="zones" fill={zColor(zone, allZones.indexOf(zone))} activeBar={false} />
                        ))
                      : <Bar dataKey="total" name="Sales rows" fill={C.violet} radius={[3, 3, 0, 0]} activeBar={false} />)}
                    {histMode === "cdf" && <Line type="monotone" dataKey="cumulative" name="At or below" stroke={C.teal} strokeWidth={2.5} dot={false} />}
                    {showThreshold && thresholdBucket && <ReferenceLine x={thresholdBucket.bucket} stroke={C.hot} strokeDasharray="4 3" label={{ value: money(threshold), fill: C.hot, fontSize: maximized ? 14 : 10 }} />}
                    {showStats && statisticBuckets.average && <ReferenceLine x={statisticBuckets.average} stroke={C.violet} strokeDasharray="3 3" />}
                    {showStats && statisticBuckets.median && <ReferenceLine x={statisticBuckets.median} stroke={C.amber} strokeDasharray="3 3" />}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {histMode === "bars" && byZone && histogramZones.length > 0 && (
                <div className={`mt-2 flex flex-wrap gap-2 font-mono ${maximized ? "text-sm" : "text-[10px]"}`}>
                  {histogramZones.map((entry) => (
                    <button
                      key={entry.zone}
                      onClick={() => toggleIsolateZone(entry.zone)}
                      className={`whitespace-nowrap rounded-md border px-2 py-1 transition ${isolatedZone && isolatedZone !== entry.zone ? "border-transparent text-[#5f5972]" : "border-white/10 text-white"}`}
                    >
                      <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: entry.color }} />
                      {entry.zone} <span data-export-strip="true">({number(entry.sales)})</span>
                    </button>
                  ))}
                </div>
              )}
              {showThreshold && <label className={`mt-2 block font-mono text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Threshold: {money(threshold)}<input type="range" min="0" max={Math.max(500, Math.ceil(Math.max(0, ...filtered.map((row) => row.price)) / 100) * 100)} step="50" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} className="mt-1 w-full accent-[#ff5d8f]" /></label>}
              <div className="mt-3 flex flex-wrap gap-4" data-export-ignore="true">
                <Toggle checked={showThreshold} onChange={setShowThreshold} label="Threshold line" />
                <Toggle checked={byZone} onChange={setByZone} label="Color by zone" />
                <Toggle checked={showStats} onChange={setShowStats} label="Stat markers" />
              </div>
            </>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Price change" hint={"rolling window vs prior period · anchored to " + (trendAsOf || inputDate(maxTime))} controls={<Segments values={["pct", "usd"] as const} value={trendMode} onChange={setTrendMode} labels={{ pct: "%", usd: "$" }} />}>
        {(maximized) => (
          <>
            <div className={`mt-3 flex flex-wrap items-center gap-4 ${maximized ? "text-base" : "text-xs"}`}>
              <label className="flex items-center gap-2 text-[#9c96b3]">As of<input type="date" value={trendAsOf} max={inputDate(maxTime)} onChange={(event) => setTrendAsOf(event.target.value)} className="rounded-lg border border-white/10 bg-[#221d3a] px-2 py-1.5 [color-scheme:dark]" /></label>
              <label className="flex items-center gap-2 text-[#9c96b3]">Custom window<input type="number" min="1" max="3650" value={customWindow} onChange={(event) => setCustomWindow(Math.max(1, Number(event.target.value) || 1))} className="w-20 rounded-lg border border-white/10 bg-[#221d3a] px-2 py-1.5" />days</label>
              <Toggle checked={trendRespectWindow} onChange={setTrendRespectWindow} label="Respect Window filter" />
            </div>
            <div className="mt-4 overflow-auto">
              <table className={`w-full min-w-[650px] border-collapse ${maximized ? "text-lg" : "text-xs"}`}>
                <thead><tr className={`uppercase tracking-[.1em] text-[#9c96b3] ${maximized ? "text-base" : "text-[10px]"}`}><th className="border-b border-white/10 px-3 py-2 text-left">Metric</th>{trendRows[0]?.values.map((value, index) => <th key={index} className="border-b border-white/10 px-3 py-2 text-center">{value.days}d</th>)}</tr></thead>
                <tbody>{trendRows.map((metric) => <tr key={metric.kind}><td className="border-b border-white/[.045] px-3 py-3 font-semibold">{metric.label}</td>{metric.values.map((value, index) => <td key={index} title={value.available ? money(value.before) + " → " + money(value.now) : "Not enough data in both periods"} className="border-b border-white/[.045] px-3 py-3 text-center font-mono font-bold">{value.available ? <span className={value.delta > 0 ? "text-[#ff5d8f]" : value.delta < 0 ? "text-[#4dd6c4]" : "text-[#9c96b3]"}>{value.delta > 0 ? "▲ " : value.delta < 0 ? "▼ " : ""}{trendMode === "pct" ? Math.abs(value.delta).toFixed(1) + "%" : money(Math.abs(value.delta))}</span> : <span className="font-normal text-[#5f5972]">—</span>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Price vs. days until event" hint="anchored to the latest recorded sale (est. event date) · respects the top filters">
        {(maximized) => (
          <>
            <div className={maximized ? "mt-4 h-[70vh]" : "mt-4 h-[320px]"}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={daysOutStats} margin={{ right: maximized ? 40 : 20 }}>
                  <CartesianGrid stroke="rgba(255,255,255,.055)" vertical={false} />
                  <XAxis dataKey="bucket" tick={axisTick(maximized, 10)} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,.09)" }} />
                  <YAxis yAxisId="tickets" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={number} />
                  <YAxis yAxisId="price" orientation="right" tick={axisTick(maximized, 10)} tickLine={false} axisLine={false} tickFormatter={(value) => `$${number(value)}`} />
                  <Tooltip contentStyle={tooltipStyle(maximized)} labelStyle={{ color: C.amber }} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                  {daysOutSeries.tickets && <Bar yAxisId="tickets" dataKey="tickets" name="Tickets sold" fill={C.violet} radius={[3, 3, 0, 0]} activeBar={false} />}
                  {daysOutSeries.getIn && <Line yAxisId="price" type={lineType} dataKey="getIn" name="Get-in price" stroke={C.amber} strokeWidth={2.4} dot={false} />}
                  {daysOutSeries.median && <Line yAxisId="price" type={lineType} dataKey="median" name="Median price" stroke={C.teal} strokeWidth={2.4} dot={false} />}
                  {daysOutSeries.average && <Line yAxisId="price" type={lineType} dataKey="average" name="Average price" stroke={C.hot} strokeWidth={2.4} dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className={`mt-2 flex flex-wrap gap-2 font-mono ${maximized ? "text-sm" : "text-[10px]"}`}>
              {(["tickets", "getIn", "median", "average"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setDaysOutSeries((current) => ({ ...current, [key]: !current[key] }))}
                  className={`rounded-md border px-2 py-1 ${daysOutSeries[key] ? "border-white/10 text-white" : "border-transparent text-[#5f5972]"}`}
                >
                  <i className="mr-1 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: key === "tickets" ? C.violet : key === "getIn" ? C.amber : key === "median" ? C.teal : C.hot }} />
                  {key === "tickets" ? "Tickets sold" : key === "getIn" ? "Get-in $/tix" : key === "median" ? "Median $/tix" : "Average $/tix"}
                </button>
              ))}
            </div>
          </>
        )}
      </Panel>
      </div>

      <Panel title="All entries · explorer" hint={number(explorerRows.length) + " matching raw rows"}>
        {(maximized) => (
          <>
            <p className={`mt-1 text-[#9c96b3] ${maximized ? "text-sm" : "text-[11px]"}`}>Independent of the top filters. Filter by zone, section, row, quantity, or price.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className={`font-bold uppercase tracking-[.14em] text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Zone</span>
                <input value={searchZone} onChange={(event) => setSearchZone(event.target.value)} placeholder="Zone" className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={`font-bold uppercase tracking-[.14em] text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Section</span>
                <input value={searchSection} onChange={(event) => setSearchSection(event.target.value)} placeholder="Section" className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={`font-bold uppercase tracking-[.14em] text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Row</span>
                <input value={searchRow} onChange={(event) => setSearchRow(event.target.value)} placeholder="Row" className="rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
              </label>
              <div className="flex flex-col gap-1.5">
                <span className={`font-bold uppercase tracking-[.14em] text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Quantity</span>
                <div className="flex gap-2">
                  <input value={minQuantity} onChange={(event) => setMinQuantity(event.target.value)} type="number" placeholder="Min" className="w-full rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
                  <input value={maxQuantity} onChange={(event) => setMaxQuantity(event.target.value)} type="number" placeholder="Max" className="w-full rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={`font-bold uppercase tracking-[.14em] text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Price</span>
                <div className="flex gap-2">
                  <input value={minPrice} onChange={(event) => setMinPrice(event.target.value)} type="number" placeholder="Min" className="w-full rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
                  <input value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} type="number" placeholder="Max" className="w-full rounded-lg border border-white/10 bg-[#221d3a] px-3 py-2 text-sm outline-none focus:border-[#b06cff]" />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => { setSearchZone(""); setSearchSection(""); setSearchRow(""); setMinQuantity(""); setMaxQuantity(""); setMinPrice(""); setMaxPrice(""); }}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs text-[#9c96b3] hover:border-[#ffb43d] hover:text-white"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className={(maximized ? "mt-3 max-h-[65vh] overflow-auto" : "mt-3 max-h-[520px] overflow-auto") + " border-t border-white/10"}>
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#1b1830]">
                  <tr>{(["timestamp", "zone", "section", "row", "quantity", "price"] as SortKey[]).map((key) => <th key={key} onClick={() => toggleSort(key, true)} className={`cursor-pointer border-b border-white/10 px-2 py-2 uppercase tracking-[.1em] text-[#9c96b3] hover:text-white ${maximized ? "text-base" : "text-[10px]"}`}>{key === "timestamp" ? "When" : key === "section" ? "Sec" : key === "quantity" ? "Qty" : key}<span className="ml-1 opacity-50">{explorerSort.key === key ? explorerSort.direction === 1 ? "▲" : "▼" : ""}</span></th>)}</tr>
                </thead>
                <tbody className="font-mono">
                  {explorerRows.slice(0, 500).map((row, index) => <tr key={row.timestamp + "-explorer-" + index} className="hover:bg-white/[.03]">
                    <td className={`whitespace-nowrap border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{displayTime(row.timestamp, venueTimeZone)}</td>
                    <td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}><span className={`rounded-full bg-[#221d3a] px-2 py-1 font-sans text-[#b06cff] ${maximized ? "text-base" : "text-[10px]"}`}>{row.zone}</span></td>
                    <td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{row.section}</td><td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{row.row}</td>
                    <td className={`border-b border-white/[.045] px-2 py-2 text-right ${maximized ? "text-lg" : "text-xs"}`}>{row.quantity}</td><td className={`border-b border-white/[.045] px-2 py-2 text-right ${maximized ? "text-lg" : "text-xs"} ` + (row.price > outlierCutoff ? "font-bold text-[#ff5d8f]" : "text-[#ffb43d]")}>{money(row.price)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            {explorerRows.length > 500 && <p className={`mt-3 font-mono text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Showing the first 500 sorted rows. Narrow the search to inspect more.</p>}
          </>
        )}
      </Panel>

      <Panel title="Recent sales" hint="follows the Window filter · click a header to sort" controls={<Segments values={[1, 3, 14, 30, 90, 180, "all"] as const} value={windowValue} onChange={setWindowValue} labels={{ 1: "1d", 3: "3d", 14: "14d", 30: "30d", 90: "3mo", 180: "6mo", all: "All" }} />}>
        {(maximized) => (
          <>
            <div className={maximized ? "mt-4 max-h-[75vh] overflow-auto" : "mt-4 max-h-[440px] overflow-auto"}>
              <table className="w-full border-collapse text-left">
                <thead className="sticky top-0 z-10 bg-[#1b1830]">
                  <tr>{(["timestamp", "zone", "section", "row", "quantity", "price"] as SortKey[]).map((key) => <th key={key} onClick={() => toggleSort(key)} className={`cursor-pointer border-b border-white/10 px-2 py-2 uppercase tracking-[.1em] text-[#9c96b3] hover:text-white ${maximized ? "text-base" : "text-[10px]"}`}>{key === "timestamp" ? "When" : key === "section" ? "Sec" : key === "quantity" ? "Qty" : key}<span className="ml-1 opacity-50">{recentSort.key === key ? recentSort.direction === 1 ? "▲" : "▼" : ""}</span></th>)}</tr>
                </thead>
                <tbody className="font-mono">
                  {recentRows.slice(0, 250).map((row, index) => <tr key={row.timestamp + "-" + index} className="hover:bg-white/[.03]">
                    <td className={`whitespace-nowrap border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{displayTime(row.timestamp, venueTimeZone)}</td>
                    <td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}><span className={`rounded-full bg-[#221d3a] px-2 py-1 font-sans text-[#b06cff] ${maximized ? "text-base" : "text-[10px]"}`}>{row.zone}</span></td>
                    <td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{row.section}</td><td className={`border-b border-white/[.045] px-2 py-2 ${maximized ? "text-lg" : "text-xs"}`}>{row.row}</td>
                    <td className={`border-b border-white/[.045] px-2 py-2 text-right ${maximized ? "text-lg" : "text-xs"}`}>{row.quantity}</td><td className={`border-b border-white/[.045] px-2 py-2 text-right text-[#ffb43d] ${maximized ? "text-lg" : "text-xs"}`}>{money(row.price)}</td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <p className={`mt-3 font-mono text-[#9c96b3] ${maximized ? "text-sm" : "text-[10px]"}`}>Showing {number(Math.min(250, recentRows.length))} of {number(recentRows.length)} matching raw rows.</p>
          </>
        )}
      </Panel>

      <footer className="pt-3 text-center font-mono text-[10px] leading-6 text-[#9c96b3]">
        <span className="text-[#ffb43d]">Authenticated full-data view:</span> raw rows are loaded from private Blob storage only after this tab is opened. Basic Auth still protects this page and API route.
      </footer>
    </div>
  );
}
