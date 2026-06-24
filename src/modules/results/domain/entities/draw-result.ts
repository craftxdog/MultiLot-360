export type ResultCreator = {
  id: string;
  username: string;
  name: string | null;
};

export type ResultDrawConfiguration = {
  id: string;
  code: string;
  time: string;
};

export type ResultDrawShift = {
  id: string;
  date: string;
  status: string;
  configuration: ResultDrawConfiguration;
};

export type ResultWinnerSummary = {
  winningSalesCount: number;
  totalPrizeMiles: number;
  paidSalesCount: number;
  paidPrizeMiles: number;
  pendingSalesCount: number;
  pendingPrizeMiles: number;
};

export type DrawResult = {
  id: string;
  shift: ResultDrawShift;
  winningNumber: string;
  createdBy: ResultCreator | null;
  createdAt: Date;
  winnerSummary: ResultWinnerSummary;
};

export type WinningSaleDetail = {
  id: string;
  number: string;
  prizeMiles: number;
  createdAt: Date;
};

export type WinningSalePayment = {
  paidAmountMiles: number;
  paidByUserId: string | null;
  paidAt: Date;
};

export type WinningSale = {
  saleId: string;
  seller: {
    id: string;
    name: string;
  };
  shift: ResultDrawShift | null;
  saleStatus: string;
  saleTotalMiles: number;
  saleCreatedAt: Date;
  winningPrizeMiles: number;
  winningDetails: WinningSaleDetail[];
  paid: boolean;
  payment: WinningSalePayment | null;
};
