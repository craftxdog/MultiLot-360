export type DrawConfiguration = {
  id: string;
  code: string;
  time: string;
  tuesdayOnly: boolean;
  autoGenerateShifts: boolean;
  singleDate: string | null;
  lockSecondsBefore: number;
  reopenSecondsAfter: number;
  active: boolean;
  deletedAt: Date | null;
  deletionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DrawConfigurationDeleteImpact = {
  configurationId: string;
  code: string;
  active: boolean;
  deletedAt: Date | null;
  counts: {
    shifts: number;
    sales: number;
    saleDetails: number;
    results: number;
    prizePayments: number;
    blockedNumbers: number;
    numberLimits: number;
  };
  requiresConfirmation: boolean;
};

export type DeleteDrawConfigurationResult = {
  configurationId: string;
  mode: 'SOFT' | 'HARD';
  deleted: true;
  impact: DrawConfigurationDeleteImpact;
};
