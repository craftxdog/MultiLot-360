import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';
import {
  NumberLimitDrawScope,
  NumberLimitSellerScope,
} from '../../../domain/entities';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d{2}$/;
const NUMBER_LIMIT_SORT_FIELDS = [
  'number',
  'limitMiles',
  'validFrom',
  'validUntil',
  'drawCode',
  'createdAt',
] as const;

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;

  return value;
};

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

export class NumberLimitSellerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class NumberLimitDrawConfigurationDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;
}

export class NumberLimitResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['GLOBAL', 'SELLER'] })
  sellerScope: NumberLimitSellerScope;

  @ApiProperty({ enum: ['DEFAULT', 'DRAW'] })
  drawScope: NumberLimitDrawScope;

  @ApiPropertyOptional({
    nullable: true,
    type: NumberLimitSellerDto,
  })
  seller: NumberLimitSellerDto | null;

  @ApiPropertyOptional({
    nullable: true,
    type: NumberLimitDrawConfigurationDto,
  })
  drawConfiguration: NumberLimitDrawConfigurationDto | null;

  @ApiProperty({ example: '02' })
  number: string;

  @ApiProperty({ example: 100 })
  limitMiles: number;

  @ApiProperty({ example: '2026-06-22' })
  validFrom: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-30' })
  validUntil: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class CreateNumberLimitsDto {
  @ApiPropertyOptional({
    description: 'Seller id. Omit it to create a global limit.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({
    description:
      'Draw configuration id. Omit it to create a default limit for all draws.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  drawConfigurationId?: string;

  @ApiPropertyOptional({
    description:
      'Draw configuration code. Use this instead of drawConfigurationId.',
    example: 'nacional-11am',
  })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiProperty({
    description: 'Lottery numbers. Can also be sent as comma-separated values.',
    example: ['02', '15', '99'],
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

  @ApiProperty({ example: 100, minimum: 1, maximum: 999999 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  limitMiles: number;

  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  validFrom: string;

  @ApiPropertyOptional({ example: '2026-06-30' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  validUntil?: string;
}

export class UpdateNumberLimitDto {
  @ApiPropertyOptional({
    nullable: true,
    description:
      'Seller id. Send null to convert this limit into a global limit.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Draw configuration id. Send null to convert this limit into a default limit.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  drawConfigurationId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Draw configuration code. Send null to convert this limit into a default limit.',
    example: 'nacional-11am',
  })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string | null;

  @ApiPropertyOptional({ example: '02' })
  @IsOptional()
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número debe tener dos dígitos, por ejemplo 02.',
  })
  number?: string;

  @ApiPropertyOptional({ example: 100, minimum: 1, maximum: 999999 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  limitMiles?: number;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  validFrom?: string;

  @ApiPropertyOptional({ nullable: true, example: '2026-06-30' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  validUntil?: string | null;
}

export class ExpireNumberLimitDto {
  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  expiresOn: string;
}

export class ListNumberLimitsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  drawConfigurationId?: string;

  @ApiPropertyOptional({ example: 'nacional-11am' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({ example: '02' })
  @IsOptional()
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número debe tener dos dígitos, por ejemplo 02.',
  })
  number?: string;

  @ApiPropertyOptional({ enum: ['GLOBAL', 'SELLER'] })
  @IsOptional()
  @Transform(({ value }) => normalizeScope(value))
  @IsIn(['GLOBAL', 'SELLER'])
  sellerScope?: NumberLimitSellerScope;

  @ApiPropertyOptional({ enum: ['DEFAULT', 'DRAW'] })
  @IsOptional()
  @Transform(({ value }) => normalizeScope(value))
  @IsIn(['DEFAULT', 'DRAW'])
  drawScope?: NumberLimitDrawScope;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  validOn?: string;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: NUMBER_LIMIT_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(NUMBER_LIMIT_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}
