export const SALE_STATUSES = ['ACTIVA', 'ANULADA'] as const;

export type SaleStatus = (typeof SALE_STATUSES)[number];

export type SaleSeller = {
  id: string;
  name: string;
};

export type SaleDrawConfiguration = {
  id: string;
  code: string;
  time: string;
};

export type SaleDrawShift = {
  id: string;
  date: string;
  status: string;
  configuration: SaleDrawConfiguration;
};

export type SaleDetail = {
  id: string;
  number: string;
  prizeMiles: number;
  createdAt: Date;
};

export type Sale = {
  id: string;
  seller: SaleSeller;
  shift: SaleDrawShift | null;
  status: SaleStatus;
  totalMiles: number;
  details: SaleDetail[];
  createdAt: Date;
  voidedByUserId: string | null;
  voidedAt: Date | null;
  voidReason: string | null;
};
