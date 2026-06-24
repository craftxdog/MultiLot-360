import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto, trimString } from '../../../../../common';

const SYSTEM_PARAMETER_SORT_FIELDS = ['key', 'updatedAt'] as const;

export class ListSystemParametersQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: 'sales.' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  key?: string;

  @ApiPropertyOptional({ default: 'key', enum: SYSTEM_PARAMETER_SORT_FIELDS })
  @IsOptional()
  @IsIn(SYSTEM_PARAMETER_SORT_FIELDS)
  sortBy: string = 'key';

  @ApiPropertyOptional({ default: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'asc';
}

export class UpsertSystemParameterDto {
  @ApiProperty({ example: '10' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(2000)
  value: string;
}

export class SystemParameterResponseDto {
  @ApiProperty({ example: 'sales.void_window_minutes' })
  key: string;

  @ApiProperty({ example: '10' })
  value: string;

  @ApiProperty()
  updatedAt: Date;
}
