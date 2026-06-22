export type DrawConfiguration = {
  id: string;
  code: string;
  time: string;
  tuesdayOnly: boolean;
  lockSecondsBefore: number;
  reopenSecondsAfter: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};
