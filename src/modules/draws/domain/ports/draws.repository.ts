import { DrawConfiguration, DrawShift } from '../entities';

export const DRAWS_REPOSITORY = Symbol('DRAWS_REPOSITORY');

export type CreateDrawConfigurationInput = {
  code: string;
  time: string;
  tuesdayOnly?: boolean;
  lockSecondsBefore?: number;
  reopenSecondsAfter?: number;
  active?: boolean;
};

export type UpdateDrawConfigurationInput = {
  configurationId: string;
  code?: string;
  time?: string;
  tuesdayOnly?: boolean;
  lockSecondsBefore?: number;
  reopenSecondsAfter?: number;
  active?: boolean;
};

export type ListDrawConfigurationsQuery = {
  active?: boolean;
};

export type OpenDrawShiftInput = {
  configurationId: string;
  date: string;
};

export type ListDrawShiftsQuery = {
  date?: string;
  status?: DrawShift['status'];
};

export type ListActiveDrawShiftsQuery = {
  date?: string;
};

export interface DrawsRepository {
  createConfiguration(
    input: CreateDrawConfigurationInput,
  ): Promise<DrawConfiguration>;
  findConfigurationById(
    configurationId: string,
  ): Promise<DrawConfiguration | null>;
  updateConfiguration(
    input: UpdateDrawConfigurationInput,
  ): Promise<DrawConfiguration | null>;
  listConfigurations(
    query: ListDrawConfigurationsQuery,
  ): Promise<DrawConfiguration[]>;
  openShift(input: OpenDrawShiftInput): Promise<DrawShift>;
  blockShift(shiftId: string): Promise<DrawShift | null>;
  reopenShift(shiftId: string): Promise<DrawShift | null>;
  closeShift(shiftId: string): Promise<DrawShift | null>;
  listShifts(query: ListDrawShiftsQuery): Promise<DrawShift[]>;
  listActiveShifts(query: ListActiveDrawShiftsQuery): Promise<DrawShift[]>;
}
