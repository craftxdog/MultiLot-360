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

export interface DrawsRepository {
  createConfiguration(
    input: CreateDrawConfigurationInput,
  ): Promise<DrawConfiguration>;
  listConfigurations(
    query: ListDrawConfigurationsQuery,
  ): Promise<DrawConfiguration[]>;
  openShift(input: OpenDrawShiftInput): Promise<DrawShift>;
  closeShift(shiftId: string): Promise<DrawShift | null>;
  listShifts(query: ListDrawShiftsQuery): Promise<DrawShift[]>;
}
