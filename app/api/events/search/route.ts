import type { SeatDataEventSearchResponse } from "@/lib/types";

const PASSTHROUGH_PARAMS = [
  "event_name",
  "event_date",
  "venue_name",
  "venue_city",
  "venue_state",
  "historical",
  "limit",
  "starting_after",
];

export async function GET(request: Request) {
  try {
    const apiKey = process.env.SEATDATA_API_KEY;

    if (!apiKey) {
      return Response.json({ error: "Missing SEATDATA_API_KEY." }, { status: 500 });
    }

    const incoming = new URL(request.url).searchParams;
    const seatDataUrl = new URL("https://seatdata.io/api/v1/events/search");

    for (const key of PASSTHROUGH_PARAMS) {
      const value = incoming.get(key);
      if (value) seatDataUrl.searchParams.set(key, value);
    }

    const seatDataResponse = await fetch(seatDataUrl.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });

    const result = await seatDataResponse.json();

    if (!seatDataResponse.ok) {
      return Response.json(
        {
          error: "SeatData search failed.",
          status: seatDataResponse.status,
          details: result,
        },
        { status: seatDataResponse.status }
      );
    }

    return Response.json(result as SeatDataEventSearchResponse);
  } catch (error) {
    console.error(error);

    return Response.json(
      { error: "Unexpected search error." },
      { status: 500 }
    );
  }
}
