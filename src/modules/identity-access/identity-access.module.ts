import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
  ResolveRequestIdentityUseCase,
  SellerAccessCodeService,
} from './application';
import {
  IDENTITY_ACCESS_REPOSITORY,
  SELLER_ONBOARDING_REPOSITORY,
} from './domain';
import {
  PrismaIdentityAccessRepository,
  PrismaSellerOnboardingRepository,
  SupabaseTokenVerifierService,
} from './infrastructure';
import {
  AuthMeController,
  ModulesGuard,
  PermissionsGuard,
  RolesGuard,
  SellerOnboardingController,
  SupabaseAuthGuard,
} from './presentation';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AuthMeController, SellerOnboardingController],
  providers: [
    PrismaIdentityAccessRepository,
    PrismaSellerOnboardingRepository,
    SellerAccessCodeService,
    SupabaseTokenVerifierService,
    ConfirmSellerAccessCodeUseCase,
    CreateSellerInvitationUseCase,
    ResolveRequestIdentityUseCase,
    {
      provide: IDENTITY_ACCESS_REPOSITORY,
      useExisting: PrismaIdentityAccessRepository,
    },
    {
      provide: SELLER_ONBOARDING_REPOSITORY,
      useExisting: PrismaSellerOnboardingRepository,
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
  exports: [
    ConfirmSellerAccessCodeUseCase,
    CreateSellerInvitationUseCase,
    ResolveRequestIdentityUseCase,
  ],
})
export class IdentityAccessModule {}
