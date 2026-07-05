import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { trimLowercaseString, trimString } from '../../../../../common';
import {
  SALES_MATRIX_STATUSES,
  SalesMatrixStatus,
} from '../../../domain/entities';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeStatus = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class GetSalesMatrixQueryDto {
  @ApiProperty({
    example: '2026-07-01',
    description: 'Business date represented by the matrix.',
  })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  shiftId?: string;

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({
    default: 'ACTIVA',
    enum: SALES_MATRIX_STATUSES,
    description:
      'ACTIVA is the operational default. TODAS includes active and voided sales for auditing.',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeStatus(value))
  @IsIn(SALES_MATRIX_STATUSES)
  status: SalesMatrixStatus = 'ACTIVA';
}

export class SalesMatrixFiltersResponseDto {
  @ApiProperty({ example: '2026-07-01' })
  date: string;

  @ApiPropertyOptional({ format: 'uuid' })
  shiftId?: string;

  @ApiPropertyOptional({ example: '11' })
  drawCode?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  sellerId?: string;

  @ApiProperty({ enum: SALES_MATRIX_STATUSES })
  status: SalesMatrixStatus;
}

export class SalesMatrixCellResponseDto {
  @ApiProperty({ example: '45' })
  number: string;

  @ApiProperty({ example: 12.9 })
  amountMiles: number;

  @ApiProperty({ example: 3 })
  salesCount: number;

  @ApiProperty({ example: 3 })
  itemsCount: number;

  @ApiProperty({ example: true })
  sold: boolean;
}

export class SalesMatrixRowResponseDto {
  @ApiProperty({ example: 4, minimum: 0, maximum: 9 })
  row: number;

  @ApiProperty({ type: [SalesMatrixCellResponseDto] })
  cells: SalesMatrixCellResponseDto[];
}

export class SalesMatrixSummaryResponseDto {
  @ApiProperty({ example: 245.75 })
  totalMiles: number;

  @ApiProperty({ example: 18 })
  salesCount: number;

  @ApiProperty({ example: 31 })
  itemsCount: number;

  @ApiProperty({ example: 22 })
  soldNumbersCount: number;
}

export class SalesMatrixRealtimeResponseDto {
  @ApiProperty({ example: '/realtime' })
  namespace: '/realtime';

  @ApiProperty({ example: ['sales.created', 'sales.voided'] })
  events: ['sales.created', 'sales.voided'];

  @ApiProperty({ example: 'REFETCH' })
  strategy: 'REFETCH';
}

export class SalesMatrixResponseDto {
  @ApiProperty({ type: SalesMatrixFiltersResponseDto })
  filters: SalesMatrixFiltersResponseDto;

  @ApiProperty({ type: [SalesMatrixRowResponseDto] })
  rows: SalesMatrixRowResponseDto[];

  @ApiProperty({ type: SalesMatrixSummaryResponseDto })
  summary: SalesMatrixSummaryResponseDto;

  @ApiProperty({ type: SalesMatrixRealtimeResponseDto })
  realtime: SalesMatrixRealtimeResponseDto;

  @ApiProperty()
  generatedAt: Date;
}
