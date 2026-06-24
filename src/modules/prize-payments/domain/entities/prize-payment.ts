export type PrizePaymentSeller = {
  id: string;
  name: string;
};

export type PrizePaymentDrawConfiguration = {
  id: string;
  code: string;
  time: string;
};

export type PrizePaymentDrawShift = {
  id: string;
  date: string;
  status: string;
  configuration: PrizePaymentDrawConfiguration;
};

export type PrizePaymentResult = {
  id: string;
  winningNumber: string;
  shift: PrizePaymentDrawShift;
};

export type PrizePaymentSale = {
  id: string;
  status: string;
  totalMiles: number;
  createdAt: Date;
  seller: PrizePaymentSeller;
  shift: PrizePaymentDrawShift | null;
};

export type PrizePaymentPayer = {
  id: string;
  username: string;
  name: string | null;
};

export type PrizePayment = {
  saleId: string;
  result: PrizePaymentResult;
  sale: PrizePaymentSale;
  paidAmountMiles: number;
  paidBy: PrizePaymentPayer | null;
  paidAt: Date;
};
