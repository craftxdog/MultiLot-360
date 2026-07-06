import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { trimString } from '../../../../../common';

export class DeleteSellerDto {
  @ApiPropertyOptional({
    example: 'Solicitud administrativa: vendedor duplicado o baja definitiva.',
    maxLength: 300,
  })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class SellerDeletionResponseDto {
  @ApiProperty({ format: 'uuid' })
  sellerId: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty({ nullable: true, format: 'uuid' })
  authUserId: string | null;

  @ApiProperty({ enum: ['soft', 'hard'] })
  mode: 'soft' | 'hard';

  @ApiProperty()
  authUserDeleted: boolean;

  @ApiProperty()
  deletedAt: Date;
}
