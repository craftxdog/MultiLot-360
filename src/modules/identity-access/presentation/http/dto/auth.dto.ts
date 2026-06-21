import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  USERNAME_FORMAT_MESSAGE,
  USERNAME_PATTERN,
  trimLowercaseString,
  trimString,
} from '../../../../../common';
import { AuthMeResponseDto } from './auth-me-response.dto';

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

  @ApiProperty({ type: AuthMeResponseDto })
  user: AuthMeResponseDto;
}

export class LogoutResponseDto {
  @ApiProperty({ example: true })
  signedOut: true;
}
