import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { ResolveRequestIdentityUseCase } from './application';
import { IDENTITY_ACCESS_REPOSITORY } from './domain';
import { PrismaIdentityAccessRepository } from './infrastructure';
import {
  AuthMeController,
  ModulesGuard,
  PermissionsGuard,
  RolesGuard,
  SupabaseAuthGuard,
} from './presentation';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AuthMeController],
  providers: [
    PrismaIdentityAccessRepository,
    ResolveRequestIdentityUseCase,
    {
      provide: IDENTITY_ACCESS_REPOSITORY,
      useExisting: PrismaIdentityAccessRepository,
    },
    {
      provide: APP_GUARD,
      useClass: SupabaseAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ModulesGuard,
    },
  ],
  exports: [ResolveRequestIdentityUseCase],
})
export class IdentityAccessModule {}
