import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
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

export type ListDrawConfigurationsQuery = OffsetPaginationQuery & {
  active?: boolean;
};

export type OpenDrawShiftInput = {
  configurationId: string;
  date: string;
};

export type ListDrawShiftsQuery = OffsetPaginationQuery & {
  date?: string;
  status?: DrawShift['status'];
};

export type ListActiveDrawShiftsQuery = OffsetPaginationQuery & {
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
  ): Promise<PaginatedResult<DrawConfiguration>>;
  openShift(input: OpenDrawShiftInput): Promise<DrawShift>;
  blockShift(shiftId: string): Promise<DrawShift | null>;
  reopenShift(shiftId: string): Promise<DrawShift | null>;
  closeShift(shiftId: string): Promise<DrawShift | null>;
  listShifts(query: ListDrawShiftsQuery): Promise<PaginatedResult<DrawShift>>;
  listActiveShifts(
    query: ListActiveDrawShiftsQuery,
  ): Promise<PaginatedResult<DrawShift>>;
}
