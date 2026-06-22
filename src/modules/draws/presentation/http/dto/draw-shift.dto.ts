import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { OffsetPaginationQueryDto, trimString } from '../../../../../common';
import { DRAW_SHIFT_STATUSES, DrawShiftStatus } from '../../../domain';
import { DrawConfigurationResponseDto } from './draw-configuration.dto';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DRAW_SHIFT_SORT_FIELDS = [
  'date',
  'status',
  'createdAt',
  'updatedAt',
  'configurationTime',
  'configurationCode',
] as const;

const normalizeStatus = (value: unknown): DrawShiftStatus | undefined =>
  typeof value === 'string'
    ? (value.trim().toUpperCase() as DrawShiftStatus)
    : undefined;

export class OpenDrawShiftDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  configurationId: string;

  @ApiProperty({ example: '2026-06-21' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date: string;
}

export class ListDrawShiftsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-06-21' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;

  @ApiPropertyOptional({ enum: DRAW_SHIFT_STATUSES })
  @IsOptional()
  @Transform(({ value }) => normalizeStatus(value))
  @IsIn(DRAW_SHIFT_STATUSES)
  status?: DrawShiftStatus;

  @ApiPropertyOptional({
    default: 'date',
    enum: DRAW_SHIFT_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(DRAW_SHIFT_SORT_FIELDS)
  sortBy: string = 'date';
}

export class ListActiveDrawShiftsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-06-21' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;

  @ApiPropertyOptional({
    default: 'date',
    enum: DRAW_SHIFT_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(DRAW_SHIFT_SORT_FIELDS)
  sortBy: string = 'date';
}

export class DrawShiftResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: '2026-06-21' })
  date: string;

  @ApiProperty({ enum: DRAW_SHIFT_STATUSES })
  status: DrawShiftStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ type: DrawConfigurationResponseDto })
  configuration: DrawConfigurationResponseDto;
}
