import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';
import { SALE_STATUSES, SaleStatus } from '../../../domain';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d{2}$/;
const SALE_SORT_FIELDS = [
  'createdAt',
  'totalMiles',
  'status',
  'date',
  'drawCode',
  'sellerName',
] as const;

const normalizeLotteryNumber = (value: unknown): unknown => {
  if (typeof value !== 'string' && typeof value !== 'number') return value;

  const digits = String(value).replace(/\D/g, '');
  return digits.length === 1 ? `0${digits}` : digits;
};

const normalizeStatus = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class SaleItemDto {
  @ApiProperty({
    example: '20',
    description: 'Two-digit lottery number.',
  })
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número debe tener dos dígitos, por ejemplo 02.',
  })
  number: string;

  @ApiProperty({
    example: 10,
    minimum: 1,
    maximum: 999999,
    description: 'Prize amount expressed in thousands. Example: 10 = 10 mil.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999999)
  prizeMiles: number;
}

export class CreateSaleDto {
  @ApiPropertyOptional({
    description:
      'Seller id. Admins can send it explicitly; sellers normally omit it.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shiftId: string;

  @ApiProperty({
    description:
      'Numbers included in the same ticket. Send one item for a normal single-number sale, or multiple items for a multi-number sale.',
    example: [
      { number: '20', prizeMiles: 10 },
      { number: '30', prizeMiles: 40 },
      { number: '50', prizeMiles: 1 },
      { number: '00', prizeMiles: 30 },
    ],
    type: [SaleItemDto],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}

export class VoidSaleDto {
  @ApiProperty({ example: 'Cliente solicito anulacion del ticket.' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(250)
  reason: string;
}

export class UpdateSalesVoidPolicyDto {
  @ApiProperty({
    example: 10,
    minimum: 1,
    maximum: 1440,
    description: 'Minutes after sale creation during which voiding is allowed.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  windowMinutes: number;
}

export class SalesVoidPolicyResponseDto {
  @ApiProperty({ example: 10 })
  windowMinutes: number;
}

export class ListSalesQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

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

  @ApiPropertyOptional({ example: '02' })
  @IsOptional()
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número debe tener dos dígitos, por ejemplo 02.',
  })
  number?: string;

  @ApiPropertyOptional({ enum: SALE_STATUSES })
  @IsOptional()
  @Transform(({ value }) => normalizeStatus(value))
  @IsIn(SALE_STATUSES)
  status?: SaleStatus;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: SALE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(SALE_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({
    default: 'desc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class SaleSellerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class SaleDrawConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;
}

export class SaleDrawShiftResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-06-22' })
  date: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: SaleDrawConfigurationResponseDto })
  configuration: SaleDrawConfigurationResponseDto;
}

export class SaleDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '02' })
  number: string;

  @ApiProperty({ example: 20 })
  prizeMiles: number;

  @ApiProperty()
  createdAt: Date;
}

export class SaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: SaleSellerResponseDto })
  seller: SaleSellerResponseDto;

  @ApiPropertyOptional({ nullable: true, type: SaleDrawShiftResponseDto })
  shift: SaleDrawShiftResponseDto | null;

  @ApiProperty({ enum: SALE_STATUSES })
  status: SaleStatus;

  @ApiProperty()
  totalMiles: number;

  @ApiProperty({ type: [SaleDetailResponseDto] })
  details: SaleDetailResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  voidedByUserId: string | null;

  @ApiPropertyOptional({ nullable: true })
  voidedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  voidReason: string | null;
}
