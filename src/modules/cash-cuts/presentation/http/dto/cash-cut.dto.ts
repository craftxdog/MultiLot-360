import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { OffsetPaginationQueryDto, trimString } from '../../../../../common';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CASH_CUT_SORT_FIELDS = ['createdAt', 'startDate', 'endDate'] as const;

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;

  return value;
};

export class CreateCashCutDto {
  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  startDate: string;

  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  endDate: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visibleToSellers?: boolean;
}

export class ListCashCutsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  visibleToSellers?: boolean;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  createdByUserId?: string;

  @ApiPropertyOptional({ default: 'createdAt', enum: CASH_CUT_SORT_FIELDS })
  @IsOptional()
  @IsIn(CASH_CUT_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class CashCutCreatorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class CashCutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-06-22' })
  startDate: string;

  @ApiProperty({ example: '2026-06-22' })
  endDate: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty()
  visibleToSellers: boolean;

  @ApiPropertyOptional({ nullable: true, type: CashCutCreatorResponseDto })
  createdBy: CashCutCreatorResponseDto | null;

  @ApiProperty()
  createdAt: Date;
}

export class CashCutSellerSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  sellerId: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty()
  activeSalesCount: number;

  @ApiProperty()
  voidedSalesCount: number;

  @ApiProperty()
  grossSalesMiles: number;

  @ApiProperty()
  voidedSalesMiles: number;

  @ApiProperty()
  netSalesMiles: number;

  @ApiProperty()
  paidPrizesMiles: number;

  @ApiProperty()
  balanceMiles: number;
}

export class CashCutTotalsResponseDto {
  @ApiProperty()
  activeSalesCount: number;

  @ApiProperty()
  voidedSalesCount: number;

  @ApiProperty()
  grossSalesMiles: number;

  @ApiProperty()
  voidedSalesMiles: number;

  @ApiProperty()
  netSalesMiles: number;

  @ApiProperty()
  paidPrizesMiles: number;

  @ApiProperty()
  balanceMiles: number;
}

export class CashCutSummaryResponseDto {
  @ApiProperty({ type: CashCutResponseDto })
  cut: CashCutResponseDto;

  @ApiProperty({ type: CashCutTotalsResponseDto })
  totals: CashCutTotalsResponseDto;

  @ApiProperty({ type: [CashCutSellerSummaryResponseDto] })
  sellers: CashCutSellerSummaryResponseDto[];
}
