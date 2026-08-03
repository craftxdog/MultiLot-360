import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiAcceptedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AuthenticatedUserContext,
  CurrentUser,
  Permissions,
  Public,
  RequireModules,
  Roles,
  SYSTEM_MODULES,
  extractBearerToken,
} from '../../../../../common';
import {
  AdminResetPasswordUseCase,
  ConfirmPasswordResetUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  RequestPasswordResetUseCase,
} from '../../../application';
import {
  AdminResetPasswordDto,
  AdminResetPasswordResponseDto,
  AuthSessionResponseDto,
  ConfirmPasswordResetDto,
  ConfirmPasswordResetResponseDto,
  LoginDto,
  LogoutResponseDto,
  RefreshSessionDto,
  RequestPasswordResetDto,
  RequestPasswordResetResponseDto,
} from '../dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly login: LoginUseCase,
    private readonly refreshSession: RefreshSessionUseCase,
    private readonly logout: LogoutUseCase,
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    private readonly confirmPasswordReset: ConfirmPasswordResetUseCase,
    private readonly adminResetPassword: AdminResetPasswordUseCase,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  signIn(@Body() body: LoginDto) {
    return this.login.execute({
      email: body.email,
      password: body.password,
      tenantSelector: body.tenant,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOkResponse({ type: AuthSessionResponseDto })
  refresh(@Body() body: RefreshSessionDto) {
    return this.refreshSession.execute({
      refreshToken: body.refreshToken,
      tenantSelector: body.tenant,
    });
  }

  @Public()
  @Post('password/reset/request')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiAcceptedResponse({ type: RequestPasswordResetResponseDto })
  requestPasswordResetEmail(@Body() body: RequestPasswordResetDto) {
    return this.requestPasswordReset.execute({ email: body.email });
  }

  @Public()
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ type: ConfirmPasswordResetResponseDto })
  confirmPasswordResetSession(@Body() body: ConfirmPasswordResetDto) {
    return this.confirmPasswordReset.execute({
      email: body.email,
      code: body.code,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
    });
  }

  @Post('password/reset/admin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @Roles('ADMIN')
  @RequireModules(SYSTEM_MODULES.usuarios)
  @Permissions('usuarios.update')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOkResponse({ type: AdminResetPasswordResponseDto })
  resetPasswordAsAdmin(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: AdminResetPasswordDto,
  ) {
    return this.adminResetPassword.execute({
      actorUserId: admin.id,
      targetUserId: body.targetUserId,
      newPassword: body.newPassword,
      confirmPassword: body.confirmPassword,
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
