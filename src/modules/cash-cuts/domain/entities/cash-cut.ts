export type CashCutCreator = {
  id: string;
  username: string;
  name: string | null;
};

export type CashCut = {
  id: string;
  startDate: string;
  endDate: string;
  description: string | null;
  visibleToSellers: boolean;
  createdBy: CashCutCreator | null;
  createdAt: Date;
};

export type CashCutSellerSummary = {
  sellerId: string;
  sellerName: string;
  activeSalesCount: number;
  voidedSalesCount: number;
  grossSalesMiles: number;
  voidedSalesMiles: number;
  netSalesMiles: number;
  paidPrizesMiles: number;
  balanceMiles: number;
};

export type CashCutSummary = {
  cut: CashCut;
  totals: {
    activeSalesCount: number;
    voidedSalesCount: number;
    grossSalesMiles: number;
    voidedSalesMiles: number;
    netSalesMiles: number;
    paidPrizesMiles: number;
    balanceMiles: number;
  };
  sellers: CashCutSellerSummary[];
};
