import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
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
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
  ListSellerInvitationsUseCase,
  ResendSellerAccessCodeUseCase,
} from '../../../application';
import {
  ConfirmSellerAccessCodeDto,
  ConfirmSellerAccessCodeResponseDto,
  CreateSellerInvitationDto,
  ListSellerInvitationsQueryDto,
  ResendSellerAccessCodeDto,
  ResendSellerAccessCodeResponseDto,
  SellerInvitationListItemResponseDto,
  SellerInvitationResponseDto,
} from '../dto';

@ApiTags('Seller onboarding')
@Controller('identity-access/sellers')
export class SellerOnboardingController {
  constructor(
    private readonly createSellerInvitation: CreateSellerInvitationUseCase,
    private readonly confirmSellerAccessCode: ConfirmSellerAccessCodeUseCase,
    private readonly resendSellerAccessCode: ResendSellerAccessCodeUseCase,
    private readonly listSellerInvitations: ListSellerInvitationsUseCase,
  ) {}

  @Get('invitations')
  @ApiBearerAuth()
  @RequireModules('usuarios')
  @Permissions('usuarios.read')
  @ApiOkResponse({ type: [SellerInvitationListItemResponseDto] })
  listInvitations(@Query() query: ListSellerInvitationsQueryDto) {
    return this.listSellerInvitations.execute({
      email: query.email,
      username: query.username,
      sellerName: query.sellerName,
      status: query.status,
      page: query.page,
      limit: query.limit,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
    });
  }

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

  @Post('access-code/resend')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @RequireModules('usuarios')
  @Permissions('usuarios.create')
  @ApiOkResponse({ type: ResendSellerAccessCodeResponseDto })
  resendAccessCode(
    @CurrentUser() admin: AuthenticatedUserContext,
    @Body() body: ResendSellerAccessCodeDto,
  ) {
    return this.resendSellerAccessCode.execute({
      email: body.email,
      adminUserId: admin.id,
    });
  }
}
