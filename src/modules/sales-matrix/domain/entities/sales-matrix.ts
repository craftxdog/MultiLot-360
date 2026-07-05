export const SALES_MATRIX_STATUSES = ['ACTIVA', 'ANULADA', 'TODAS'] as const;

export type SalesMatrixStatus = (typeof SALES_MATRIX_STATUSES)[number];

export type SalesMatrixFilters = {
  date: string;
  shiftId?: string;
  drawCode?: string;
  sellerId?: string;
  status: SalesMatrixStatus;
};

export type SalesMatrixCell = {
  number: string;
  amountMiles: number;
  salesCount: number;
  itemsCount: number;
  sold: boolean;
};

export type SalesMatrixRow = {
  row: number;
  cells: SalesMatrixCell[];
};

export type SalesMatrix = {
  filters: SalesMatrixFilters;
  rows: SalesMatrixRow[];
  summary: {
    totalMiles: number;
    salesCount: number;
    itemsCount: number;
    soldNumbersCount: number;
  };
  realtime: {
    namespace: '/realtime';
    events: ['sales.created', 'sales.voided'];
    strategy: 'REFETCH';
  };
  generatedAt: Date;
};
