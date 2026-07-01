import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Public, extractBearerToken } from '../../../../../common';
import {
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  SignupAdminUseCase,
} from '../../../application';
import {
  AuthSessionResponseDto,
  LoginDto,
  LogoutResponseDto,
  RefreshSessionDto,
  SignupAdminDto,
} from '../dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly signupAdmin: SignupAdminUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
  ) {}

  @Public()
  @Post('signup')
  @ApiCreatedResponse({ type: AuthSessionResponseDto })
  signup(@Body() body: SignupAdminDto) {
    return this.signupAdmin.execute({
      email: body.email,
      username: body.username,
      password: body.password,
      name: body.name,
    });
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthSessionResponseDto })
  signIn(@Body() body: LoginDto) {
    return this.login.execute({
      email: body.email,
      password: body.password,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: AuthSessionResponseDto })
  refresh(@Body() body: RefreshSessionDto) {
    return this.refreshSession.execute({
      refreshToken: body.refreshToken,
    });
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOkResponse({ type: LogoutResponseDto })
  signOut(@Headers('authorization') authorization: string | undefined) {
    const token = extractBearerToken({
      headers: {
        authorization,
      },
    });

    if (!token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    return this.logout.execute({
      accessToken: token,
    });
  }
}
