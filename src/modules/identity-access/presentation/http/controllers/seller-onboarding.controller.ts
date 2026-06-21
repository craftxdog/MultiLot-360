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
import { SellerOnboardingHttpMapper } from '../mappers';

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
    return this.listSellerInvitations.execute(
      SellerOnboardingHttpMapper.toListInvitationsQuery(query),
    );
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
  @RequireModules('usuarios')
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
}
