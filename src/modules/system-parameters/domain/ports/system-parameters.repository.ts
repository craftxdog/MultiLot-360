import {
  OffsetPaginationQuery,
  PaginatedResult,
} from '../../../../shared-kernel';
import { SystemParameter } from '../entities';

export const SYSTEM_PARAMETERS_REPOSITORY = Symbol(
  'SYSTEM_PARAMETERS_REPOSITORY',
);

export type ListSystemParametersQuery = OffsetPaginationQuery & {
  key?: string;
};

export type UpsertSystemParameterInput = {
  key: string;
  value: string;
};

export interface SystemParametersRepository {
  findByKey(key: string): Promise<SystemParameter | null>;
  list(
    query: ListSystemParametersQuery,
  ): Promise<PaginatedResult<SystemParameter>>;
  upsert(input: UpsertSystemParameterInput): Promise<SystemParameter>;
}
