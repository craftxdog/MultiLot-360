import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trimLowercaseString } from '../../../../../common';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  if (['true', '1', 'yes'].includes(value.toLowerCase())) return true;
  if (['false', '0', 'no'].includes(value.toLowerCase())) return false;

  return value;
};

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

export class ListDrawConfigurationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  active?: boolean;
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
  lockSecondsBefore: number;

  @ApiProperty()
  reopenSecondsAfter: number;

  @ApiProperty()
  active: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
