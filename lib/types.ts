export type SeatDataSale = {
  timestamp: number;
  quantity: number;
  price: number;
  zone: string | null;
  section: string | null;
  row: string | null;
};

export type SalesOverTimePoint = {
  date: string;
  ticketsSold: number;
  grossSales: number;
  averagePrice: number;
};

export type SalesByZonePoint = {
  zone: string;
  ticketsSold: number;
  grossSales: number;
  averagePrice: number;
};

export type PriceBucketPoint = {
  bucket: string;
  ticketsSold: number;
};

export type SeatDataEventSearchResult = {
  event_id: number;
  event_name: string;
  event_date: string;
  event_time?: string;
  venue_name: string;
  venue_city: string;
  venue_state: string;
  days_on_seatdata?: number;
};

export type SeatDataEventSearchResponse = {
  data: SeatDataEventSearchResult[];
  has_more: boolean;
  next_cursor: string | null;
};

export type DashboardData = {
  eventId: string;
  generatedAt: string;
  summary: {
    totalTicketsSold: number;
    grossSales: number;
    averagePrice: number;
    medianPrice: number;
    transactionCount: number;
  };
  charts: {
    salesOverTime: SalesOverTimePoint[];
    salesByZone: SalesByZonePoint[];
    priceBuckets: PriceBucketPoint[];
  };
};