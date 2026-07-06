export type OperationalReportFilters = {
  dateFrom: string;
  dateUntil: string;
  sellerId?: string;
  drawCode?: string;
};

export type OperationalOverviewReport = {
  filters: OperationalReportFilters;
  salesCount: number;
  activeSalesCount: number;
  voidedSalesCount: number;
  grossSalesMiles: number;
  voidedSalesMiles: number;
  netSalesMiles: number;
  winningPrizeMiles: number;
  paidPrizesMiles: number;
  pendingPrizesMiles: number;
  balanceMiles: number;
};

export type SellerOperationalReport = {
  sellerId: string;
  sellerName: string;
  salesCount: number;
  activeSalesCount: number;
  voidedSalesCount: number;
  grossSalesMiles: number;
  voidedSalesMiles: number;
  netSalesMiles: number;
  winningPrizeMiles: number;
  paidPrizesMiles: number;
  pendingPrizesMiles: number;
  balanceMiles: number;
};

export type BusinessAnalyticsFilters = OperationalReportFilters & {
  topLimit: number;
};

export type BusinessAnalyticsSummary = {
  salesCount: number;
  activeSalesCount: number;
  voidedSalesCount: number;
  grossSalesMiles: number;
  netSalesMiles: number;
  voidedSalesMiles: number;
  winningPrizeMiles: number;
  paidPrizesMiles: number;
  pendingPrizesMiles: number;
  balanceMiles: number;
  averageTicketMiles: number;
  activeSellersCount: number;
  numbersSoldCount: number;
  bestSeller: Pick<
    BusinessAnalyticsSellerKpi,
    'sellerId' | 'sellerName' | 'netSalesMiles'
  > | null;
  bestNumber: Pick<
    BusinessAnalyticsNumberKpi,
    'number' | 'netSalesMiles' | 'ticketsCount'
  > | null;
  bestDay: Pick<
    BusinessAnalyticsDayKpi,
    'date' | 'netSalesMiles' | 'salesCount'
  > | null;
};

export type BusinessAnalyticsSellerKpi = {
  sellerId: string;
  sellerName: string;
  salesCount: number;
  activeSalesCount: number;
  voidedSalesCount: number;
  netSalesMiles: number;
  grossSalesMiles: number;
  paidPrizesMiles: number;
  balanceMiles: number;
  averageTicketMiles: number;
  numbersSoldCount: number;
  contributionPercent: number;
};

export type BusinessAnalyticsNumberKpi = {
  number: string;
  ticketsCount: number;
  sellersCount: number;
  netSalesMiles: number;
  averagePrizeMiles: number;
};

export type BusinessAnalyticsDayKpi = {
  date: string;
  salesCount: number;
  sellersCount: number;
  netSalesMiles: number;
  grossSalesMiles: number;
  averageTicketMiles: number;
};

export type BusinessAnalyticsProjection = {
  periodDays: number;
  averageDailyNetSalesMiles: number;
  projectedNext7DaysNetSalesMiles: number;
  projectedNext30DaysNetSalesMiles: number;
};

export type BusinessAnalyticsReport = {
  filters: BusinessAnalyticsFilters;
  summary: BusinessAnalyticsSummary;
  sellers: BusinessAnalyticsSellerKpi[];
  topNumbers: BusinessAnalyticsNumberKpi[];
  bestDays: BusinessAnalyticsDayKpi[];
  trend: BusinessAnalyticsDayKpi[];
  projection: BusinessAnalyticsProjection;
};
