import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SELLER_REPORT_SORT_FIELDS = [
  'sellerName',
  'netSalesMiles',
  'paidPrizesMiles',
  'balanceMiles',
] as const;

export class OperationalReportQueryDto {
  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  dateFrom: string;

  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  dateUntil: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;
}

export class SellerOperationalReportsQueryDto extends OffsetPaginationQueryDto {
  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  dateFrom: string;

  @ApiProperty({ example: '2026-06-22' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  dateUntil: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({
    default: 'sellerName',
    enum: SELLER_REPORT_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(SELLER_REPORT_SORT_FIELDS)
  sortBy: string = 'sellerName';

  @ApiPropertyOptional({ default: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'asc';
}

export class OperationalReportFiltersResponseDto {
  @ApiProperty({ example: '2026-06-22' })
  dateFrom: string;

  @ApiProperty({ example: '2026-06-22' })
  dateUntil: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  sellerId?: string;

  @ApiPropertyOptional({ nullable: true })
  drawCode?: string;
}

export class OperationalOverviewReportResponseDto {
  @ApiProperty({ type: OperationalReportFiltersResponseDto })
  filters: OperationalReportFiltersResponseDto;

  @ApiProperty()
  salesCount: number;

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
  winningPrizeMiles: number;

  @ApiProperty()
  paidPrizesMiles: number;

  @ApiProperty()
  pendingPrizesMiles: number;

  @ApiProperty()
  balanceMiles: number;
}

export class SellerOperationalReportResponseDto {
  @ApiProperty({ format: 'uuid' })
  sellerId: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty()
  salesCount: number;

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
  winningPrizeMiles: number;

  @ApiProperty()
  paidPrizesMiles: number;

  @ApiProperty()
  pendingPrizesMiles: number;

  @ApiProperty()
  balanceMiles: number;
}
