import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  USERNAME_FORMAT_MESSAGE,
  USERNAME_PATTERN,
  trimLowercaseString,
  trimString,
} from '../../common';

export const BILLING_CHANNELS = [
  'BANK_TRANSFER',
  'PAYPAL',
  'DEVELOPMENT',
] as const;
export type BillingChannel = (typeof BILLING_CHANNELS)[number];

const uppercase = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const optionalNumber = (value: unknown): unknown =>
  value === undefined ? undefined : Number(value);

export class PaidCompanySignupDto {
  @ApiProperty({ example: 'propietario@empresa.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'propietario' })
  @Transform(({ value }) => trimLowercaseString(value))
  @Matches(USERNAME_PATTERN, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @ApiProperty({ example: 'Ana Pérez' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Sup3rSecret2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({ example: 'Lotería Central, S.A.' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  companyName: string;

  @ApiProperty({ example: 'loteria-central' })
  @Transform(({ value }) => trimLowercaseString(value))
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  @MaxLength(80)
  companySlug: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  priceId: string;

  @ApiPropertyOptional({ enum: BILLING_CHANNELS, default: 'BANK_TRANSFER' })
  @Transform(({ value }) => uppercase(value))
  @IsOptional()
  @IsIn(BILLING_CHANNELS)
  paymentMethod?: BillingChannel;

  @ApiPropertyOptional({ default: 'America/Managua' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  timezone?: string;
}

export class BillingPlansQueryDto {
  @ApiPropertyOptional({ enum: BILLING_CHANNELS, default: 'BANK_TRANSFER' })
  @Transform(({ value }) => uppercase(value))
  @IsOptional()
  @IsIn(BILLING_CHANNELS)
  channel?: BillingChannel;
}

export class BankTransferSubmissionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  bankAccountId: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @ApiProperty({ description: 'Exact amount in minor currency units.' })
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor: number;

  @ApiProperty({ enum: ['NIO', 'USD'] })
  @Transform(({ value }) => uppercase(value))
  @IsIn(['NIO', 'USD'])
  currency: 'NIO' | 'USD';

  @ApiProperty({ format: 'date-time' })
  @IsDateString()
  transferredAt: string;

  @ApiProperty({ maxLength: 160 })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  payerName: string;

  @ApiPropertyOptional({ pattern: '^[0-9]{4}$' })
  @IsOptional()
  @Matches(/^[0-9]{4}$/)
  sourceAccountLast4?: string;
}

export class ReviewBankTransferDto {
  @ApiProperty({ enum: ['APROBADA', 'RECHAZADA'] })
  @Transform(({ value }) => uppercase(value))
  @IsIn(['APROBADA', 'RECHAZADA'])
  decision: 'APROBADA' | 'RECHAZADA';

  @ApiPropertyOptional({ maxLength: 160 })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(160)
  confirmedBankReference?: string;

  @ApiPropertyOptional({ maxLength: 1000 })
  @Transform(({ value }) => trimString(value))
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class TransferQueueQueryDto {
  @ApiPropertyOptional({
    enum: [
      'PENDIENTE_EVIDENCIA',
      'EN_REVISION',
      'APROBADA',
      'RECHAZADA',
      'CANCELADA',
    ],
    default: 'EN_REVISION',
  })
  @Transform(({ value }) => uppercase(value))
  @IsOptional()
  @IsIn([
    'PENDIENTE_EVIDENCIA',
    'EN_REVISION',
    'APROBADA',
    'RECHAZADA',
    'CANCELADA',
  ])
  status?: string;

  @ApiPropertyOptional({ default: 100, minimum: 1, maximum: 200 })
  @Transform(({ value }) => optionalNumber(value))
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class BillingCycleDto {
  @ApiPropertyOptional({ format: 'date-time' })
  @IsOptional()
  @IsDateString()
  now?: string;
}

export class DevelopmentBillingCompleteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  onboardingId: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  @MaxLength(160)
  providerSubscriptionId: string;
}

export class PaypalWebhookDto {
  @IsString()
  id: string;

  @IsString()
  event_type: string;

  @IsOptional()
  resource?: Record<string, unknown>;

  @IsOptional()
  create_time?: string;
}
