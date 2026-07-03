import type {
  DashboardData,
  PriceBucketPoint,
  SalesByZonePoint,
  SalesOverTimePoint,
  SeatDataSale,
} from "./types";

function safeNumber(value: unknown): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function getUtcDateFromUnixSeconds(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

function getWeightedMedianPrice(records: SeatDataSale[]): number {
  const sorted = [...records]
    .map((record) => ({
      price: safeNumber(record.price),
      quantity: safeNumber(record.quantity),
    }))
    .filter((record) => record.quantity > 0)
    .sort((a, b) => a.price - b.price);

  const totalQuantity = sorted.reduce((sum, record) => sum + record.quantity, 0);

  if (totalQuantity === 0) {
    return 0;
  }

  const midpoint = totalQuantity / 2;
  let runningQuantity = 0;

  for (const record of sorted) {
    runningQuantity += record.quantity;

    if (runningQuantity >= midpoint) {
      return record.price;
    }
  }

  return sorted[sorted.length - 1]?.price ?? 0;
}

function buildPriceBuckets(records: SeatDataSale[]): PriceBucketPoint[] {
  const buckets = [
    { min: 0, max: 50, label: "$0-$50" },
    { min: 50, max: 100, label: "$50-$100" },
    { min: 100, max: 150, label: "$100-$150" },
    { min: 150, max: 200, label: "$150-$200" },
    { min: 200, max: 300, label: "$200-$300" },
    { min: 300, max: 500, label: "$300-$500" },
    { min: 500, max: Number.POSITIVE_INFINITY, label: "$500+" },
  ];

  const bucketMap = new Map<string, number>();

  for (const bucket of buckets) {
    bucketMap.set(bucket.label, 0);
  }

  for (const record of records) {
    const price = safeNumber(record.price);
    const quantity = safeNumber(record.quantity);

    const bucket = buckets.find((item) => price >= item.min && price < item.max);

    if (!bucket) continue;

    bucketMap.set(bucket.label, (bucketMap.get(bucket.label) ?? 0) + quantity);
  }

  return Array.from(bucketMap.entries()).map(([bucket, ticketsSold]) => ({
    bucket,
    ticketsSold,
  }));
}

export function aggregateSalesData(
  eventId: string,
  rawRecords: SeatDataSale[]
): DashboardData {
  const records = rawRecords.filter((record) => {
    return (
      Number.isFinite(Number(record.timestamp)) &&
      Number.isFinite(Number(record.quantity)) &&
      Number.isFinite(Number(record.price))
    );
  });

  const totalTicketsSold = records.reduce(
    (sum, record) => sum + safeNumber(record.quantity),
    0
  );

  const grossSales = records.reduce((sum, record) => {
    return sum + safeNumber(record.quantity) * safeNumber(record.price);
  }, 0);

  const averagePrice = totalTicketsSold > 0 ? grossSales / totalTicketsSold : 0;

  const medianPrice = getWeightedMedianPrice(records);

  const byDate = new Map<
    string,
    { ticketsSold: number; grossSales: number }
  >();

  for (const record of records) {
    const date = getUtcDateFromUnixSeconds(safeNumber(record.timestamp));
    const quantity = safeNumber(record.quantity);
    const price = safeNumber(record.price);

    const current = byDate.get(date) ?? {
      ticketsSold: 0,
      grossSales: 0,
    };

    current.ticketsSold += quantity;
    current.grossSales += quantity * price;

    byDate.set(date, current);
  }

  const salesOverTime: SalesOverTimePoint[] = Array.from(byDate.entries())
    .map(([date, data]) => ({
      date,
      ticketsSold: data.ticketsSold,
      grossSales: data.grossSales,
      averagePrice:
        data.ticketsSold > 0 ? data.grossSales / data.ticketsSold : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byZone = new Map<
    string,
    { ticketsSold: number; grossSales: number }
  >();

  for (const record of records) {
    const zone = record.zone?.trim() || "Unknown";
    const quantity = safeNumber(record.quantity);
    const price = safeNumber(record.price);

    const current = byZone.get(zone) ?? {
      ticketsSold: 0,
      grossSales: 0,
    };

    current.ticketsSold += quantity;
    current.grossSales += quantity * price;

    byZone.set(zone, current);
  }

  const salesByZone: SalesByZonePoint[] = Array.from(byZone.entries())
    .map(([zone, data]) => ({
      zone,
      ticketsSold: data.ticketsSold,
      grossSales: data.grossSales,
      averagePrice:
        data.ticketsSold > 0 ? data.grossSales / data.ticketsSold : 0,
    }))
    .sort((a, b) => b.ticketsSold - a.ticketsSold);

  const priceBuckets = buildPriceBuckets(records);

  return {
    eventId,
    generatedAt: new Date().toISOString(),
    summary: {
      totalTicketsSold,
      grossSales,
      averagePrice,
      medianPrice,
      transactionCount: records.length,
    },
    charts: {
      salesOverTime,
      salesByZone,
      priceBuckets,
    },
  };
}