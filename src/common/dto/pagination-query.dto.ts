import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  CursorPaginationQuery,
  OffsetPaginationQuery,
  SortDirection,
} from '../../shared-kernel';
import { trimString } from '../constants';

export const DEFAULT_CURSOR_LIMIT = 50;
export const MAX_CURSOR_LIMIT = 100;
export const DEFAULT_OFFSET_PAGE = 1;
export const DEFAULT_OFFSET_LIMIT = 25;
export const MAX_OFFSET_LIMIT = 100;

export class CursorPaginationQueryDto implements CursorPaginationQuery {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CURSOR_LIMIT)
  limit: number = DEFAULT_CURSOR_LIMIT;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/)
  sortBy: string = 'creado_en';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: SortDirection = 'desc';
}

export class OffsetPaginationQueryDto implements OffsetPaginationQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_OFFSET_PAGE;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OFFSET_LIMIT)
  limit: number = DEFAULT_OFFSET_LIMIT;

  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/)
  sortBy: string = 'creado_en';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: SortDirection = 'desc';
}
