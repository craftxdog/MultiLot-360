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
