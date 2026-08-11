import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthMeUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  authUserId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  email?: string | null;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  roleId?: string;

  @ApiPropertyOptional()
  roleName?: string;

  @ApiPropertyOptional()
  active?: boolean;

  @ApiPropertyOptional({ type: [String] })
  modules?: string[];

  @ApiPropertyOptional({ type: [String] })
  permissions?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  tenantId?: string;

  @ApiPropertyOptional({ example: 'mi-empresa' })
  tenantSlug?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  membershipId?: string;

  @ApiPropertyOptional()
  isOwner?: boolean;
}

export class AuthMeSellerDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  active?: boolean;
}

export class AuthMeResponseDto {
  @ApiProperty({ type: AuthMeUserDto })
  user: AuthMeUserDto;

  @ApiPropertyOptional({ type: AuthMeSellerDto })
  seller?: AuthMeSellerDto;
}
