import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { OffsetPaginationQueryDto, trimString } from '../../../../../common';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const AUDIT_EVENT_SORT_FIELDS = ['createdAt', 'event', 'id'] as const;

export class ListAuditEventsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  userId?: string;

  @ApiPropertyOptional({ example: 'http.request.completed' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  event?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha inicial debe tener formato YYYY-MM-DD.',
  })
  createdFrom?: string;

  @ApiPropertyOptional({ example: '2026-06-22' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(DATE_PATTERN, {
    message: 'La fecha final debe tener formato YYYY-MM-DD.',
  })
  createdUntil?: string;

  @ApiPropertyOptional({ default: 'createdAt', enum: AUDIT_EVENT_SORT_FIELDS })
  @IsOptional()
  @IsIn(AUDIT_EVENT_SORT_FIELDS)
  sortBy: string = 'createdAt';

  @ApiPropertyOptional({ default: 'desc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection: 'asc' | 'desc' = 'desc';
}

export class AuditEventActorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name: string | null;
}

export class AuditEventResponseDto {
  @ApiProperty({ description: 'Audit event id represented as a string.' })
  id: string;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  userId: string | null;

  @ApiProperty()
  event: string;

  @ApiPropertyOptional({
    nullable: true,
    type: Object,
    additionalProperties: true,
  })
  payload: unknown;

  @ApiPropertyOptional({ nullable: true, type: AuditEventActorResponseDto })
  actor: AuditEventActorResponseDto | null;

  @ApiProperty()
  createdAt: Date;
}
