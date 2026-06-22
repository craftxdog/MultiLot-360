import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';
import { BlockedNumberScope } from '../../../domain';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d{2}$/;
const BLOCKED_NUMBER_SORT_FIELDS = [
  'createdAt',
  'number',
  'date',
  'drawCode',
] as const;

const normalizeLotteryNumber = (value: unknown): unknown => {
  if (typeof value !== 'string' && typeof value !== 'number') return value;

  const digits = String(value).replace(/\D/g, '');
  return digits.length === 1 ? `0${digits}` : digits;
};

const normalizeLotteryNumbers = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeLotteryNumber(item));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeLotteryNumber(item.trim()))
      .filter(Boolean);
  }

  return value;
};

const normalizeScope = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class CreateBlockedNumbersDto {
  @ApiProperty({
    description: 'Lottery numbers. Can also be sent as comma-separated values.',
    example: ['02', '15'],
    type: [String],
  })
  @Transform(({ value }) => normalizeLotteryNumbers(value))
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @Matches(NUMBER_PATTERN, {
    each: true,
    message: 'Cada número debe tener dos dígitos, por ejemplo 02.',
  })
  numbers: string[];

  @ApiPropertyOptional({
    description: 'Draw shift id. Use this for a shift-scoped block.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

  @ApiPropertyOptional({
    description: 'Date. Use this for a full-day block across every shift.',
    example: '2026-06-22',
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;

  @ApiPropertyOptional({ example: 'Numero reservado por decision operativa.' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(250)
  reason?: string;
}

export class ListBlockedNumbersQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: '02' })
  @IsOptional()
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número debe tener dos dígitos, por ejemplo 02.',
  })
  number?: string;

  @ApiPropertyOptional({ enum: ['DATE', 'SHIFT'] })
  @IsOptional()
  @Transform(({ value }) => normalizeScope(value))
  @IsIn(['DATE', 'SHIFT'])
  scope?: BlockedNumberScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;

  @ApiPropertyOptional({ example: 'nacional-11am' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  createdByUserId?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: BLOCKED_NUMBER_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(BLOCKED_NUMBER_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class BlockedNumberCreatorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class BlockedNumberDrawConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;
}

export class BlockedNumberShiftResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-06-22' })
  date: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: BlockedNumberDrawConfigurationResponseDto })
  configuration: BlockedNumberDrawConfigurationResponseDto;
}

export class BlockedNumberResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['DATE', 'SHIFT'] })
  scope: BlockedNumberScope;

  @ApiProperty({ example: '02' })
  number: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-22' })
  date: string | null;

  @ApiPropertyOptional({ nullable: true, type: BlockedNumberShiftResponseDto })
  shift: BlockedNumberShiftResponseDto | null;

  @ApiPropertyOptional({ nullable: true })
  reason: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: BlockedNumberCreatorResponseDto,
  })
  createdBy: BlockedNumberCreatorResponseDto | null;

  @ApiProperty()
  createdAt: Date;
}
