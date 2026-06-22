import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the previous page.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  cursor?: string;

  @ApiPropertyOptional({
    default: DEFAULT_CURSOR_LIMIT,
    maximum: MAX_CURSOR_LIMIT,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CURSOR_LIMIT)
  limit: number = DEFAULT_CURSOR_LIMIT;

  @ApiPropertyOptional({
    default: 'creado_en',
    description: 'Field used to sort the page.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/)
  sortBy: string = 'creado_en';

  @ApiPropertyOptional({
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: SortDirection = 'desc';
}

export class OffsetPaginationQueryDto implements OffsetPaginationQuery {
  @ApiPropertyOptional({
    default: DEFAULT_OFFSET_PAGE,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = DEFAULT_OFFSET_PAGE;

  @ApiPropertyOptional({
    default: DEFAULT_OFFSET_LIMIT,
    maximum: MAX_OFFSET_LIMIT,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_OFFSET_LIMIT)
  limit: number = DEFAULT_OFFSET_LIMIT;

  @ApiPropertyOptional({
    default: 'creado_en',
    description: 'Field used to sort the page.',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-zA-Z][a-zA-Z0-9_.]*$/)
  sortBy: string = 'creado_en';

  @ApiPropertyOptional({
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: SortDirection = 'desc';
}
