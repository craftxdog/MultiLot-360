import { Body, Controller, Post } from '@nestjs/common';
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
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
} from '../../../application';
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
  ) {}

  @Post('invitations')
  @ApiBearerAuth()
  @RequireModules('usuarios')
  @Permissions('usuarios.create')
  @ApiCreatedResponse({ type: SellerInvitationResponseDto })
  createInvitation(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: CreateSellerInvitationDto,
  ) {
    return this.createSellerInvitation.execute({
      email: body.email,
      username: body.username,
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
  @ApiOkResponse({ type: ConfirmSellerAccessCodeResponseDto })
  confirmAccessCode(@Body() body: ConfirmSellerAccessCodeDto) {
    return this.confirmSellerAccessCode.execute({
      email: body.email,
      accessCode: body.accessCode,
      password: body.password,
    });
  }
}
