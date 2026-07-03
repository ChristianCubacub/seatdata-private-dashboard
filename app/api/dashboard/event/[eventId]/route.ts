import { get } from "@vercel/blob";

export async function GET(
  request: Request,
  context: { params: Promise<{ eventId: string }> }
) {
  try {
    const { eventId } = await context.params;

    if (!eventId) {
      return Response.json({ error: "Missing eventId." }, { status: 400 });
    }

    const aggregatePath = `aggregates/events/${eventId}/dashboard.json`;

    const blob = await get(aggregatePath, {
      access: "private",
    });

    if (!blob?.stream) {
      return Response.json(
        {
          error: "No dashboard data found for this event. Import it first.",
        },
        { status: 404 }
      );
    }

    const jsonText = await new Response(blob.stream).text();

    return new Response(jsonText, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(error);

    return Response.json(
      {
        error: "Unexpected dashboard data error.",
      },
      { status: 500 }
    );
  }
}