import { put } from "@vercel/blob";
import { aggregateSalesData } from "@/lib/aggregateSales";
import type { SeatDataSale } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const apiKey = process.env.SEATDATA_API_KEY;

    if (!apiKey) {
      return Response.json(
        { error: "Missing SEATDATA_API_KEY." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const eventId = String(body.eventId ?? "").trim();

    if (!eventId) {
      return Response.json({ error: "Missing eventId." }, { status: 400 });
    }

    const seatDataUrl = new URL(
      "https://seatdata.io/api/v0.3/salesdata/get"
    );

    seatDataUrl.searchParams.set("event_id", eventId);

    const seatDataResponse = await fetch(seatDataUrl.toString(), {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });

    if (!seatDataResponse.ok) {
      const errorText = await seatDataResponse.text();

      return Response.json(
        {
          error: "SeatData request failed.",
          status: seatDataResponse.status,
          details: errorText,
        },
        { status: seatDataResponse.status }
      );
    }

    const rawSales = (await seatDataResponse.json()) as SeatDataSale[];

    if (!Array.isArray(rawSales)) {
      return Response.json(
        { error: "SeatData response was not an array." },
        { status: 502 }
      );
    }

    const dashboardData = aggregateSalesData(eventId, rawSales);

    const rawPath = `raw/events/${eventId}/sales.json`;
    const aggregatePath = `aggregates/events/${eventId}/dashboard.json`;

    await put(rawPath, JSON.stringify(rawSales), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });

    await put(aggregatePath, JSON.stringify(dashboardData), {
      access: "private",
      allowOverwrite: true,
      contentType: "application/json",
    });

    return Response.json({
      success: true,
      eventId,
      recordsStored: rawSales.length,
      aggregatePath,
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Unexpected import error.",
      },
      { status: 500 }
    );
  }
}