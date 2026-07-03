"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

export default function DashboardPage() {
  const [eventId, setEventId] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(
    null
  );
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function importEvent() {
    const cleanEventId = eventId.trim();

    if (!cleanEventId) {
      setStatus("Enter a SeatData event ID first.");
      return;
    }

    setIsLoading(true);
    setStatus("Importing from SeatData...");

    try {
      const importResponse = await fetch("/api/import/seatdata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ eventId: cleanEventId }),
      });

      const importResult = await importResponse.json();

      if (!importResponse.ok) {
        setStatus(importResult.error ?? "Import failed.");
        return;
      }

      setStatus(
        `Imported ${importResult.recordsStored} raw records. Loading dashboard...`
      );

      await loadDashboard(cleanEventId);
    } catch {
      setStatus("Import failed because of a network or server error.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadDashboard(id = eventId.trim()) {
    if (!id) {
      setStatus("Enter a SeatData event ID first.");
      return;
    }

    setIsLoading(true);
    setStatus("Loading aggregate dashboard data...");

    try {
      const response = await fetch(`/api/dashboard/event/${id}`, {
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error ?? "Could not load dashboard data.");
        setDashboardData(null);
        return;
      }

      setDashboardData(result);
      setStatus("Dashboard loaded.");
    } catch {
      setStatus("Dashboard failed to load.");
      setDashboardData(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-sm uppercase tracking-[0.3em] text-zinc-500">
            Private SeatData Dashboard
          </p>
          <h1 className="mt-3 text-4xl font-semibold">
            Aggregated Ticket Sales
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Raw SeatData records are stored privately on the backend. This page
            only receives aggregate chart data.
          </p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <label className="block text-sm font-medium text-zinc-300">
            SeatData Event ID
          </label>

          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
              placeholder="Example: 12345"
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-100 outline-none focus:border-zinc-400"
            />

            <button
              onClick={importEvent}
              disabled={isLoading}
              className="rounded-xl bg-zinc-100 px-5 py-3 font-medium text-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import / Refresh
            </button>

            <button
              onClick={() => loadDashboard()}
              disabled={isLoading}
              className="rounded-xl border border-zinc-700 px-5 py-3 font-medium text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Load Cached
            </button>
          </div>

          {status && <p className="mt-3 text-sm text-zinc-400">{status}</p>}
        </section>

        {dashboardData && (
          <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Tickets sold</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatNumber(dashboardData.summary.totalTicketsSold)}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Gross sales estimate</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(dashboardData.summary.grossSales)}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Average price</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(dashboardData.summary.averagePrice)}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-500">Median price</p>
                <p className="mt-2 text-3xl font-semibold">
                  {formatCurrency(dashboardData.summary.medianPrice)}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Sales over time</h2>
              <div className="mt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={dashboardData.charts.salesOverTime}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="ticketsSold"
                      name="Tickets sold"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Tickets sold by zone</h2>
              <div className="mt-6 h-96">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.salesByZone.slice(0, 12)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="zone" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="ticketsSold" name="Tickets sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <h2 className="text-xl font-semibold">Price distribution</h2>
              <div className="mt-6 h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboardData.charts.priceBuckets}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="ticketsSold" name="Tickets sold" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}