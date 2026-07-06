import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  AssignUserRoleUseCase,
  CreateAccessRoleUseCase,
  GetSystemParameterUseCase,
  GetAccessRoleUseCase,
  ListAccessModulesUseCase,
  ListAccessRolesUseCase,
  ListSystemParametersUseCase,
  ReplaceAccessRolePermissionsUseCase,
  UpsertSystemParameterUseCase,
} from './application';
import {
  ACCESS_CONTROL_REPOSITORY,
  SYSTEM_PARAMETERS_REPOSITORY,
} from './domain';
import {
  PrismaAccessControlRepository,
  PrismaSystemParametersRepository,
} from './infrastructure';
import {
  AccessControlController,
  SystemParametersController,
} from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [AccessControlController, SystemParametersController],
  providers: [
    PrismaAccessControlRepository,
    PrismaSystemParametersRepository,
    AssignUserRoleUseCase,
    CreateAccessRoleUseCase,
    GetAccessRoleUseCase,
    GetSystemParameterUseCase,
    ListAccessModulesUseCase,
    ListAccessRolesUseCase,
    ListSystemParametersUseCase,
    ReplaceAccessRolePermissionsUseCase,
    UpsertSystemParameterUseCase,
    {
      provide: ACCESS_CONTROL_REPOSITORY,
      useExisting: PrismaAccessControlRepository,
    },
    {
      provide: SYSTEM_PARAMETERS_REPOSITORY,
      useExisting: PrismaSystemParametersRepository,
    },
  ],
  exports: [
    GetSystemParameterUseCase,
    ListSystemParametersUseCase,
    UpsertSystemParameterUseCase,
  ],
})
export class SystemParametersModule {}
