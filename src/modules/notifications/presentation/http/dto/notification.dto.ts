import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { OffsetPaginationQueryDto, trimString } from '../../../../../common';

const toOptionalBoolean = (value: unknown): unknown => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
};

export class ListNotificationsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: 'draw.shift.opened' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(80)
  type?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => toOptionalBoolean(value))
  @IsBoolean()
  unread?: boolean;
}

export class NotificationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  type: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty({ nullable: true, type: Object })
  data: Record<string, unknown> | null;

  @ApiProperty({ nullable: true })
  readAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class NotificationUnreadCountResponseDto {
  @ApiProperty()
  unread: number;
}

export class MarkAllNotificationsReadResponseDto {
  @ApiProperty()
  updatedCount: number;

  @ApiProperty()
  readAt: Date;
}
