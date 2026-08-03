import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  USERNAME_FORMAT_MESSAGE,
  USERNAME_PATTERN,
  trimLowercaseString,
  trimString,
} from '../../../../../common';

export class AuthSessionRoleDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ADMIN' })
  name: string;
}

export class AuthSessionTenantDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'mi-empresa' })
  slug: string;

  @ApiProperty({ example: 'Mi Empresa' })
  name: string;

  @ApiProperty({ format: 'uuid' })
  membershipId: string;

  @ApiProperty()
  isOwner: boolean;
}

export class AuthSessionSellerDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  active: boolean;
}

export class AuthSessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  authUserId: string;

  @ApiProperty()
  username: string;

  @ApiPropertyOptional({ nullable: true })
  name?: string | null;

  @ApiProperty()
  active: boolean;

  @ApiProperty({ type: AuthSessionRoleDto })
  role: AuthSessionRoleDto;

  @ApiProperty({ type: [String] })
  modules: string[];

  @ApiProperty({ type: [String] })
  permissions: string[];

  @ApiPropertyOptional({ type: AuthSessionTenantDto })
  tenant?: AuthSessionTenantDto;

  @ApiPropertyOptional({ type: AuthSessionSellerDto })
  seller?: AuthSessionSellerDto;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Sup3rSecret2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({
    required: false,
    example: 'mi-empresa',
    description:
      'Slug o UUID del tenant. Es obligatorio cuando la cuenta pertenece a más de una empresa.',
  })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenant?: string;
}

export class SignupAdminDto {
  @ApiProperty({ example: 'admin@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'admin' })
  @Transform(({ value }) => trimLowercaseString(value))
  @Matches(USERNAME_PATTERN, { message: USERNAME_FORMAT_MESSAGE })
  username: string;

  @ApiProperty({ example: 'Admin Principal' })
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'Sup3rSecret2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}

export class RefreshSessionDto {
  @ApiProperty()
  @IsString()
  refreshToken: string;

  @ApiProperty({ required: false, example: 'mi-empresa' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsOptional()
  @IsString()
  @MaxLength(80)
  tenant?: string;
}

export class AuthSessionResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty({ example: 'bearer' })
  tokenType: 'bearer';

  @ApiProperty({ type: AuthSessionUserDto })
  user: AuthSessionUserDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  signedOut: true;
}

export class RequestPasswordResetDto {
  @ApiProperty({ example: 'usuario@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;
}

export class RequestPasswordResetResponseDto {
  @ApiProperty({ example: true })
  accepted: true;

  @ApiProperty({
    example:
      'Si existe una cuenta elegible, enviaremos un código para restablecer la contraseña.',
  })
  message: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ example: 'usuario@example.com' })
  @Transform(({ value }) => trimLowercaseString(value))
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Matches(/^\d{6}$/, { message: 'code must contain exactly 6 digits' })
  code: string;

  @ApiProperty({ example: 'NuevaClave2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;

  @ApiProperty({ example: 'NuevaClave2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  confirmPassword: string;
}

export class ConfirmPasswordResetResponseDto {
  @ApiProperty({ example: true })
  passwordUpdated: true;

  @ApiProperty({
    example: true,
    description:
      'Supabase refresh sessions were revoked. Already-issued access tokens can remain valid until their JWT expiration.',
  })
  sessionsRevoked: true;
}

export class AdminResetPasswordDto {
  @ApiProperty({ description: 'Internal usuarios.id of the target account.' })
  @IsUUID()
  targetUserId: string;

  @ApiProperty({ example: 'NuevaClave2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;

  @ApiProperty({ example: 'NuevaClave2026!' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  confirmPassword: string;
}

export class AdminResetPasswordResponseDto extends ConfirmPasswordResetResponseDto {
  @ApiProperty()
  targetUser: {
    id: string;
    username: string;
  };
}
