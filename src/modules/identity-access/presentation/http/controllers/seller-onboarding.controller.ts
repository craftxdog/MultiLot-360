import {
  Body,
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  Permissions,
  Public,
  RequireModules,
  extractBearerToken,
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
} from '../../../application';
import { SupabaseTokenVerifierService } from '../../../infrastructure';
import {
  ConfirmSellerAccessCodeDto,
  ConfirmSellerAccessCodeResponseDto,
  CreateSellerInvitationDto,
  SellerInvitationResponseDto,
} from '../dto';

@ApiTags('Seller onboarding')
@Controller('identity-access/sellers')
export class SellerOnboardingController {
  constructor(
    private readonly createSellerInvitation: CreateSellerInvitationUseCase,
    private readonly confirmSellerAccessCode: ConfirmSellerAccessCodeUseCase,
    private readonly supabaseTokenVerifier: SupabaseTokenVerifierService,
  ) {}

  @Post('invitations')
  @ApiBearerAuth()
  @RequireModules('vendedores')
  @Permissions('vendedores.create')
  @ApiCreatedResponse({ type: SellerInvitationResponseDto })
  createInvitation(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: CreateSellerInvitationDto,
  ) {
    return this.createSellerInvitation.execute({
      email: body.email,
      sellerName: body.sellerName,
      documentId: body.documentId,
      phone: body.phone,
      address: body.address,
      roleName: body.roleName,
      adminUserId: admin.id,
      adminName: admin.username ?? admin.roleName ?? 'Administrador',
    });
  }

  @Public()
  @Post('access-code/confirm')
  @ApiBearerAuth()
  @ApiOkResponse({ type: ConfirmSellerAccessCodeResponseDto })
  async confirmAccessCode(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: ConfirmSellerAccessCodeDto,
  ) {
    const token = extractBearerToken({
      headers: {
        authorization,
      },
    });

    if (!token) {
      throw new UnauthorizedException('Bearer token is required');
    }

    const payload = await this.supabaseTokenVerifier.verify(token);

    if (!payload.sub) {
      throw new UnauthorizedException('Supabase subject claim is required');
    }

    return this.confirmSellerAccessCode.execute({
      email: body.email,
      accessCode: body.accessCode,
      authUserId: payload.sub,
    });
  }
}
