import { get } from "@vercel/blob";

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    if (!/^\d+$/.test(eventId)) {
      return Response.json({ error: "Invalid eventId." }, { status: 400 });
    }

    const blob = await get(`raw/events/${eventId}/sales.json`, {
      access: "private",
    });

    if (!blob?.stream) {
      return Response.json(
        { error: "No raw data found for this event. Import it first." },
        { status: 404 }
      );
    }

    return new Response(blob.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "private, no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Unexpected raw data error." }, { status: 500 });
  }
}
