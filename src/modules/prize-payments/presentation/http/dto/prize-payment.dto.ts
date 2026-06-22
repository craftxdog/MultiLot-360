import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PRIZE_PAYMENT_SORT_FIELDS = [
  'paidAt',
  'paidAmountMiles',
  'sellerName',
  'drawCode',
] as const;

export class PayPrizeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  resultId: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Winning sale id. This is also the prize payment id.',
  })
  @IsUUID('4')
  saleId: string;
}

export class ListPrizePaymentsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  resultId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  saleId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  paidByUserId?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha debe tener formato YYYY-MM-DD.',
  })
  date?: string;

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  paidFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  paidUntil?: string;

  @ApiPropertyOptional({
    default: 'paidAt',
    enum: PRIZE_PAYMENT_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(PRIZE_PAYMENT_SORT_FIELDS)
  sortBy: string = 'paidAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class PrizePaymentSellerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class PrizePaymentDrawConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;
}

export class PrizePaymentDrawShiftResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-06-22' })
  date: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: PrizePaymentDrawConfigurationResponseDto })
  configuration: PrizePaymentDrawConfigurationResponseDto;
}

export class PrizePaymentResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '20' })
  winningNumber: string;

  @ApiProperty({ type: PrizePaymentDrawShiftResponseDto })
  shift: PrizePaymentDrawShiftResponseDto;
}

export class PrizePaymentSaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalMiles: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: PrizePaymentSellerResponseDto })
  seller: PrizePaymentSellerResponseDto;

  @ApiPropertyOptional({
    nullable: true,
    type: PrizePaymentDrawShiftResponseDto,
  })
  shift: PrizePaymentDrawShiftResponseDto | null;
}

export class PrizePaymentPayerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class PrizePaymentResponseDto {
  @ApiProperty({ format: 'uuid' })
  saleId: string;

  @ApiProperty({ type: PrizePaymentResultResponseDto })
  result: PrizePaymentResultResponseDto;

  @ApiProperty({ type: PrizePaymentSaleResponseDto })
  sale: PrizePaymentSaleResponseDto;

  @ApiProperty()
  paidAmountMiles: number;

  @ApiPropertyOptional({ nullable: true, type: PrizePaymentPayerResponseDto })
  paidBy: PrizePaymentPayerResponseDto | null;

  @ApiProperty()
  paidAt: Date;
}
