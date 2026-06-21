import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthMeUserDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  authUserId?: string | null;

  @ApiPropertyOptional()
  username?: string;

  @ApiPropertyOptional()
  roleId?: string;

  @ApiPropertyOptional()
  roleName?: string;

  @ApiPropertyOptional({ type: [String] })
  modules?: string[];

  @ApiPropertyOptional({ type: [String] })
  permissions?: string[];
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
