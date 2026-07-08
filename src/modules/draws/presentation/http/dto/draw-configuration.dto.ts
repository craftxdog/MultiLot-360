import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
} from '../../../../../common';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DRAW_CONFIGURATION_SORT_FIELDS = [
  'code',
  'time',
  'active',
  'createdAt',
  'updatedAt',
] as const;

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;

  return value;
};

const trimUnknownString = (value: unknown): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDrawConfigurationDto {
  @ApiProperty({ example: 'nacional-11am' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)
  code: string;

  @ApiProperty({ example: '11:00:00' })
  @IsString()
  @Matches(TIME_PATTERN, {
    message: 'La hora debe tener formato HH:mm o HH:mm:ss.',
  })
  time: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  tuesdayOnly?: boolean;

  @ApiPropertyOptional({
    default: true,
    description:
      'When true, the API can auto-create a daily shift for each operable date.',
  })
  @IsOptional()
  @IsBoolean()
  autoGenerateShifts?: boolean;

  @ApiPropertyOptional({
    example: '2026-07-07',
    description:
      'Required when autoGenerateShifts=false. The configuration only operates on this date.',
  })
  @ValidateIf(
    (dto: CreateDrawConfigurationDto) => dto.autoGenerateShifts === false,
  )
  @Transform(({ value }) => trimUnknownString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha única debe tener formato YYYY-MM-DD.',
  })
  singleDate?: string;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  lockSecondsBefore?: number;

  @ApiPropertyOptional({ default: 600 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  reopenSecondsAfter?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class UpdateDrawConfigurationDto extends PartialType(
  CreateDrawConfigurationDto,
) {}

export class ListDrawConfigurationsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({
    default: 'time',
    enum: DRAW_CONFIGURATION_SORT_FIELDS,
  })
  @IsOptional()
  @IsIn(DRAW_CONFIGURATION_SORT_FIELDS)
  sortBy: string = 'time';

  @ApiPropertyOptional({
    default: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'asc';
}

export class DrawConfigurationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  code: string;

  @ApiProperty({ example: '11:00:00' })
  time: string;

  @ApiProperty()
  tuesdayOnly: boolean;

  @ApiProperty()
  autoGenerateShifts: boolean;

  @ApiPropertyOptional({ nullable: true, example: '2026-07-07' })
  singleDate: string | null;

  @ApiProperty()
  lockSecondsBefore: number;

  @ApiProperty()
  reopenSecondsAfter: number;

  @ApiProperty()
  active: boolean;

  @ApiPropertyOptional({ nullable: true })
  deletedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  deletionReason: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class SoftDeleteDrawConfigurationDto {
  @ApiPropertyOptional({ maxLength: 250 })
  @IsOptional()
  @Transform(({ value }) => trimUnknownString(value))
  @IsString()
  @MaxLength(250)
  reason?: string;
}

export class HardDeleteDrawConfigurationDto extends SoftDeleteDrawConfigurationDto {
  @ApiProperty({
    description:
      'Current admin password. The API reauthenticates the actor before destructive deletion.',
  })
  @IsString()
  @MaxLength(72)
  adminPassword: string;

  @ApiProperty({
    example: 'DELETE_DRAW_CONFIGURATION',
    description: 'Explicit confirmation phrase required for hard delete.',
  })
  @IsString()
  @Matches(/^DELETE_DRAW_CONFIGURATION$/)
  confirmation: 'DELETE_DRAW_CONFIGURATION';
}

export class DrawConfigurationDeleteImpactCountsDto {
  @ApiProperty()
  shifts: number;

  @ApiProperty()
  sales: number;

  @ApiProperty()
  saleDetails: number;

  @ApiProperty()
  results: number;

  @ApiProperty()
  prizePayments: number;

  @ApiProperty()
  blockedNumbers: number;

  @ApiProperty()
  numberLimits: number;
}

export class DrawConfigurationDeleteImpactResponseDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  configurationId: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  active: boolean;

  @ApiPropertyOptional({ nullable: true })
  deletedAt: Date | null;

  @ApiProperty({ type: DrawConfigurationDeleteImpactCountsDto })
  counts: DrawConfigurationDeleteImpactCountsDto;

  @ApiProperty()
  requiresConfirmation: boolean;
}

export class DeleteDrawConfigurationResponseDto {
  @ApiProperty({ format: 'uuid' })
  configurationId: string;

  @ApiProperty({ enum: ['SOFT', 'HARD'] })
  mode: 'SOFT' | 'HARD';

  @ApiProperty()
  deleted: true;

  @ApiProperty({ type: DrawConfigurationDeleteImpactResponseDto })
  impact: DrawConfigurationDeleteImpactResponseDto;
}
