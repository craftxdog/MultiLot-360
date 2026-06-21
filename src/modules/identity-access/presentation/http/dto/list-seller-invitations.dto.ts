import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  OffsetPaginationQueryDto,
  trimLowercaseString,
  trimString,
} from '../../../../../common';
import {
  SELLER_ACCESS_CODE_STATUSES,
  SellerAccessCodeStatus,
} from '../../../domain';

const normalizeStatus = (value: unknown): SellerAccessCodeStatus | undefined =>
  typeof value === 'string'
    ? (value.trim().toUpperCase() as SellerAccessCodeStatus)
    : undefined;

export class ListSellerInvitationsQueryDto extends OffsetPaginationQueryDto {
  @ApiPropertyOptional({ example: 'seller@example.com' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'seller.01' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  @MaxLength(80)
  username?: string;

  @ApiPropertyOptional({ example: 'Seller One' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(120)
  sellerName?: string;

  @ApiPropertyOptional({
    enum: SELLER_ACCESS_CODE_STATUSES,
    example: 'PENDIENTE',
  })
  @IsOptional()
  @Transform(({ value }) => normalizeStatus(value))
  @IsIn(SELLER_ACCESS_CODE_STATUSES)
  status?: SellerAccessCodeStatus;
}

class SellerInvitationCreatedByResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty({ nullable: true })
  name: string | null;
}

export class SellerInvitationListItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty()
  documentId: string;

  @ApiProperty({ enum: SELLER_ACCESS_CODE_STATUSES })
  status: SellerAccessCodeStatus;

  @ApiProperty()
  expiresAt: Date;

  @ApiProperty({ nullable: true })
  usedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({
    nullable: true,
    type: SellerInvitationCreatedByResponseDto,
  })
  createdBy: SellerInvitationCreatedByResponseDto | null;
}
