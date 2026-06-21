import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentSeller, CurrentUser } from '../../../../../common';
import {
  AuthenticatedUserContext,
  SellerContext,
} from '../../../../../common/interfaces';
import { AuthMeResponseDto } from '../dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthMeController {
  @Get('me')
  @ApiOkResponse({ type: AuthMeResponseDto })
  getMe(
    @CurrentUser() user: AuthenticatedUserContext,
    @CurrentSeller() seller?: SellerContext,
  ): AuthMeResponseDto {
    return {
      user,
      ...(seller && { seller }),
    };
  }
}
