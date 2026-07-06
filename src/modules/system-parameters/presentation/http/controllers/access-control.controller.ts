import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import {
  AssignUserRoleUseCase,
  CreateAccessRoleUseCase,
  GetAccessRoleUseCase,
  ListAccessModulesUseCase,
  ListAccessRolesUseCase,
  ReplaceAccessRolePermissionsUseCase,
} from '../../../application';
import {
  AccessModuleResponseDto,
  AccessRoleResponseDto,
  AccessUserRoleResponseDto,
  AssignUserRoleDto,
  CreateAccessRoleDto,
  ListAccessQueryDto,
  ReplaceAccessRolePermissionsDto,
} from '../dto';

@ApiTags('System parameters - access control')
@ApiBearerAuth()
@Controller('parameters/access')
@RequireModules(SYSTEM_MODULES.roles)
export class AccessControlController {
  constructor(
    private readonly listModules: ListAccessModulesUseCase,
    private readonly listRoles: ListAccessRolesUseCase,
    private readonly getRole: GetAccessRoleUseCase,
    private readonly createRole: CreateAccessRoleUseCase,
    private readonly replacePermissions: ReplaceAccessRolePermissionsUseCase,
    private readonly assignRole: AssignUserRoleUseCase,
  ) {}

  @Get('modules')
  @Permissions('roles.read')
  @ApiOkResponse({ type: [AccessModuleResponseDto] })
  modules(@Query() query: ListAccessQueryDto) {
    return this.listModules.execute(query);
  }

  @Get('roles')
  @Permissions('roles.read')
  @ApiOkResponse({ type: [AccessRoleResponseDto] })
  roles(@Query() query: ListAccessQueryDto) {
    return this.listRoles.execute(query);
  }

  @Get('roles/:roleId')
  @Permissions('roles.read')
  @ApiOkResponse({ type: AccessRoleResponseDto })
  role(@Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string) {
    return this.getRole.execute({ roleId });
  }

  @Post('roles')
  @Permissions('roles.create')
  @ApiCreatedResponse({ type: AccessRoleResponseDto })
  create(@Body() body: CreateAccessRoleDto) {
    return this.createRole.execute(body);
  }

  @Put('roles/:roleId/permissions')
  @Permissions('roles.update')
  @ApiOkResponse({ type: AccessRoleResponseDto })
  permissions(
    @Param('roleId', new ParseUUIDPipe({ version: '4' })) roleId: string,
    @Body() body: ReplaceAccessRolePermissionsDto,
  ) {
    return this.replacePermissions.execute({ roleId, ...body });
  }

  @Patch('users/:userId/role')
  @Permissions('roles.update')
  @ApiOkResponse({ type: AccessUserRoleResponseDto })
  userRole(
    @Param('userId', new ParseUUIDPipe({ version: '4' })) userId: string,
    @Body() body: AssignUserRoleDto,
    @CurrentUser() actor: AuthenticatedUserContext,
  ) {
    return this.assignRole.execute({
      userId,
      roleId: body.roleId,
      actorUserId: actor.id,
    });
  }
}
