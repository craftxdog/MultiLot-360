import { ApiProperty } from '@nestjs/swagger';

export class RevokeSellerInvitationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty()
  sellerId: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  sellerName: string;

  @ApiProperty({ example: 'REVOCADO' })
  status: 'REVOCADO';
}
