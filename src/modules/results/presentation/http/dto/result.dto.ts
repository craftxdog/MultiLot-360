import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER_PATTERN = /^\d{2}$/;
const RESULT_SORT_FIELDS = [
  'createdAt',
  'winningNumber',
  'date',
  'drawCode',
] as const;
const WINNING_SALE_SORT_FIELDS = [
  'createdAt',
  'sellerName',
  'totalMiles',
] as const;

const normalizeLotteryNumber = (value: unknown): unknown => {
  if (typeof value !== 'string' && typeof value !== 'number') return value;

  const digits = String(value).replace(/\D/g, '');
  return digits.length === 1 ? `0${digits}` : digits;
};

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;

  return value;
};

export class CreateResultDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  shiftId: string;

  @ApiProperty({
    example: '20',
    description: 'Winning two-digit lottery number.',
  })
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número ganador debe tener dos dígitos, por ejemplo 02.',
  })
  winningNumber: string;
}

export class ListResultsQueryDto extends OffsetPaginationQueryDto {
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

  @ApiPropertyOptional({ example: '11' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  drawCode?: string;

  @ApiPropertyOptional({ example: '20' })
  @IsOptional()
  @Transform(({ value }) => normalizeLotteryNumber(value))
  @IsString()
  @Matches(NUMBER_PATTERN, {
    message: 'El número ganador debe tener dos dígitos, por ejemplo 02.',
  })
  winningNumber?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  createdByUserId?: string;

  @ApiPropertyOptional({ default: 'createdAt', enum: RESULT_SORT_FIELDS })
  @IsOptional()
  @IsIn(RESULT_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class ListWinningSalesQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  sellerId?: string;

  @ApiPropertyOptional({
    description: 'Filter winning sales by payment status.',
  })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  paid?: boolean;

  @ApiPropertyOptional({
    default: 'createdAt',
    enum: WINNING_SALE_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(WINNING_SALE_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class ResultCreatorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class ResultDrawConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;
}

export class ResultDrawShiftResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '2026-06-22' })
  date: string;

  @ApiProperty()
  status: string;

  @ApiProperty({ type: ResultDrawConfigurationResponseDto })
  configuration: ResultDrawConfigurationResponseDto;
}

export class ResultWinnerSummaryResponseDto {
  @ApiProperty()
  winningSalesCount: number;

  @ApiProperty()
  totalPrizeMiles: number;

  @ApiProperty()
  paidSalesCount: number;

  @ApiProperty()
  paidPrizeMiles: number;

  @ApiProperty()
  pendingSalesCount: number;

  @ApiProperty()
  pendingPrizeMiles: number;
}

export class ResultResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: ResultDrawShiftResponseDto })
  shift: ResultDrawShiftResponseDto;

  @ApiProperty({ example: '20' })
  winningNumber: string;

  @ApiPropertyOptional({ nullable: true, type: ResultCreatorResponseDto })
  createdBy: ResultCreatorResponseDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: ResultWinnerSummaryResponseDto })
  winnerSummary: ResultWinnerSummaryResponseDto;
}

export class WinningSaleSellerResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;
}

export class WinningSaleDetailResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '20' })
  number: string;

  @ApiProperty({ example: 10 })
  prizeMiles: number;

  @ApiProperty()
  createdAt: Date;
}

export class WinningSalePaymentResponseDto {
  @ApiProperty()
  paidAmountMiles: number;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  paidByUserId: string | null;

  @ApiProperty()
  paidAt: Date;
}

export class WinningSaleResponseDto {
  @ApiProperty({ format: 'uuid' })
  saleId: string;

  @ApiProperty({ type: WinningSaleSellerResponseDto })
  seller: WinningSaleSellerResponseDto;

  @ApiPropertyOptional({ nullable: true, type: ResultDrawShiftResponseDto })
  shift: ResultDrawShiftResponseDto | null;

  @ApiProperty()
  saleStatus: string;

  @ApiProperty()
  saleTotalMiles: number;

  @ApiProperty()
  saleCreatedAt: Date;

  @ApiProperty()
  winningPrizeMiles: number;

  @ApiProperty({ type: [WinningSaleDetailResponseDto] })
  winningDetails: WinningSaleDetailResponseDto[];

  @ApiProperty()
  paid: boolean;

  @ApiPropertyOptional({ nullable: true, type: WinningSalePaymentResponseDto })
  payment: WinningSalePaymentResponseDto | null;
}
