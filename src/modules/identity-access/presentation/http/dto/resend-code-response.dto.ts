import { ApiProperty } from '@nestjs/swagger';

export class ResendSellerAccessCodeResponseDto {
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
