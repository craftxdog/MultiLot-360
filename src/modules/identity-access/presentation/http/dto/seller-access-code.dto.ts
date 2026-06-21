import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  DOCUMENT_ID_FORMAT_MESSAGE,
  NICARAGUA_DOCUMENT_ID_PATTERN,
  PHONE_NUMBER_FORMAT_MESSAGE,
  PHONE_NUMBER_PATTERN,
  USERNAME_FORMAT_MESSAGE,
  USERNAME_PATTERN,
  normalizeDocumentId,
  normalizePhoneNumber,
  trimLowercaseString,
  trimString,
} from '../../../../../common';

export class CreateSellerInvitationDto {
  @ApiProperty({ example: 'vendedor@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'carlos.lopez' })
  @Transform(({ value }) => trimLowercaseString(value))
  @Matches(USERNAME_PATTERN, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @ApiProperty({ example: 'Carlos Lopez' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  sellerName: string;

  @ApiProperty({ example: '001-010190-0001A' })
  @Transform(({ value }) => normalizeDocumentId(value))
  @Matches(NICARAGUA_DOCUMENT_ID_PATTERN, {
    message: DOCUMENT_ID_FORMAT_MESSAGE,
  })
  documentId: string;

  @ApiPropertyOptional({ example: '+50588889999' })
  @IsOptional()
  @Transform(({ value }) => normalizePhoneNumber(value))
  @Matches(PHONE_NUMBER_PATTERN, {
    message: PHONE_NUMBER_FORMAT_MESSAGE,
  })
  phone?: string;

  @ApiPropertyOptional({ example: 'Managua, Nicaragua' })
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MaxLength(240)
  address?: string;

  @ApiPropertyOptional({ example: 'vendedor' })
  @IsOptional()
  @Transform(({ value }) => trimLowercaseString(value))
  @IsString()
  @MaxLength(80)
  roleName?: string;
}

export class SellerInvitationResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty()
  expiresAt: Date;
}

export class ConfirmSellerAccessCodeDto {
  @ApiProperty({ example: 'vendedor@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @Matches(/^\d{6}$/)
  accessCode: string;

  @ApiProperty({ example: 'Sup3rSecret2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class ConfirmSellerAccessCodeResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  email: string;
}
