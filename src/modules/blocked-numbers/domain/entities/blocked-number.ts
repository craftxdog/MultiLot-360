export type BlockedNumberScope = 'DATE' | 'SHIFT';

export type BlockedNumberCreator = {
  id: string;
  username: string;
  name: string | null;
} | null;

export type BlockedNumberDrawConfiguration = {
  id: string;
  code: string;
  time: string;
};

export type BlockedNumberShift = {
  id: string;
  date: string;
  status: string;
  configuration: BlockedNumberDrawConfiguration;
} | null;

export type BlockedNumber = {
  id: string;
  scope: BlockedNumberScope;
  number: string;
  date: string | null;
  shift: BlockedNumberShift;
  reason: string | null;
  createdBy: BlockedNumberCreator;
  createdAt: Date;
};
