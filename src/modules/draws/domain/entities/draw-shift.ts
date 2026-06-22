import { DrawConfiguration } from './draw-configuration';

export const DRAW_SHIFT_STATUSES = ['ABIERTO', 'BLOQUEO', 'CERRADO'] as const;

export type DrawShiftStatus = (typeof DRAW_SHIFT_STATUSES)[number];

export type DrawShift = {
  id: string;
  date: string;
  status: DrawShiftStatus;
  createdAt: Date;
  updatedAt: Date;
  configuration: DrawConfiguration;
};
