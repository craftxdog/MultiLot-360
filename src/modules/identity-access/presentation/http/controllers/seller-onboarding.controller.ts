import {
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  AnyPermissions,
  CurrentUser,
  Permissions,
  Public,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
  ListSellerInvitationsUseCase,
  ResendSellerAccessCodeUseCase,
  RevokeSellerInvitationUseCase,
} from '../../../application';
import {
  ConfirmSellerAccessCodeDto,
  ConfirmSellerAccessCodeResponseDto,
  CreateSellerInvitationDto,
  ListSellerInvitationsQueryDto,
  ResendSellerAccessCodeDto,
  ResendSellerAccessCodeResponseDto,
  RevokeSellerInvitationResponseDto,
  SellerInvitationListItemResponseDto,
  SellerInvitationResponseDto,
} from '../dto';
import { SellerOnboardingHttpMapper } from '../mappers';

@ApiTags('Seller onboarding')
@Controller('identity-access/sellers')
export class SellerOnboardingController {
  constructor(
    private readonly createSellerInvitation: CreateSellerInvitationUseCase,
    private readonly confirmSellerAccessCode: ConfirmSellerAccessCodeUseCase,
    private readonly resendSellerAccessCode: ResendSellerAccessCodeUseCase,
    private readonly listSellerInvitations: ListSellerInvitationsUseCase,
    private readonly revokeSellerInvitation: RevokeSellerInvitationUseCase,
  ) {}

  @Get('invitations')
  @ApiBearerAuth()
  @RequireModules(SYSTEM_MODULES.usuarios)
  @Permissions('usuarios.read')
  @ApiOkResponse({ type: [SellerInvitationListItemResponseDto] })
  listInvitations(@Query() query: ListSellerInvitationsQueryDto) {
    return this.listSellerInvitations.execute(
      SellerOnboardingHttpMapper.toListInvitationsQuery(query),
    );
  }

  @Post('invitations')
  @ApiBearerAuth()
  @RequireModules(SYSTEM_MODULES.usuarios)
  @Permissions('usuarios.create')
  @ApiCreatedResponse({ type: SellerInvitationResponseDto })
  createInvitation(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: CreateSellerInvitationDto,
  ) {
    return this.createSellerInvitation.execute(
      SellerOnboardingHttpMapper.toCreateInvitationCommand(body, admin),
    );
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

  @Post('access-code/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RequireModules(SYSTEM_MODULES.usuarios)
  @Permissions('usuarios.create')
  @ApiOkResponse({ type: ResendSellerAccessCodeResponseDto })
  resendAccessCode(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: ResendSellerAccessCodeDto,
  ) {
    return this.resendSellerAccessCode.execute(
      SellerOnboardingHttpMapper.toResendAccessCodeCommand(body, admin),
    );
  }

  @Patch('invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RequireModules(SYSTEM_MODULES.usuarios)
  @AnyPermissions('usuarios.update', 'usuarios.create')
  @ApiParam({ name: 'invitationId', format: 'uuid' })
  @ApiOkResponse({ type: RevokeSellerInvitationResponseDto })
  revokeInvitation(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Param('invitationId', new ParseUUIDPipe({ version: '4' }))
    invitationId: string,
  ) {
    return this.revokeSellerInvitation.execute(
      SellerOnboardingHttpMapper.toRevokeInvitationCommand(invitationId, admin),
    );
  }
}
