import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import {
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  ResendSellerAccessCodeUseCase,
  ResolveRequestIdentityUseCase,
  SellerAccessCodeService,
  SignupAdminUseCase,
} from './application';
import {
  AUTH_ACCOUNT_REPOSITORY,
  AUTH_PROVIDER,
  IDENTITY_ACCESS_REPOSITORY,
  SELLER_ONBOARDING_REPOSITORY,
} from './domain';
import {
  PrismaAuthAccountRepository,
  PrismaIdentityAccessRepository,
  PrismaSellerOnboardingRepository,
  SupabaseAuthProviderService,
  SupabaseTokenVerifierService,
} from './infrastructure';
import {
  AuthController,
  AuthMeController,
  ModulesGuard,
  PermissionsGuard,
  RolesGuard,
  SellerOnboardingController,
  SupabaseAuthGuard,
} from './presentation';

@Module({
  imports: [DatabaseModule, JwtModule.register({})],
  controllers: [AuthController, AuthMeController, SellerOnboardingController],
  providers: [
    PrismaAuthAccountRepository,
    PrismaIdentityAccessRepository,
    PrismaSellerOnboardingRepository,
    SellerAccessCodeService,
    SupabaseAuthProviderService,
    SupabaseTokenVerifierService,
    ConfirmSellerAccessCodeUseCase,
    CreateSellerInvitationUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    ResendSellerAccessCodeUseCase,
    ResolveRequestIdentityUseCase,
    SignupAdminUseCase,
    {
      provide: AUTH_ACCOUNT_REPOSITORY,
      useExisting: PrismaAuthAccountRepository,
    },
    {
      provide: AUTH_PROVIDER,
      useExisting: SupabaseAuthProviderService,
    },
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
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    ResendSellerAccessCodeUseCase,
    ResolveRequestIdentityUseCase,
    SignupAdminUseCase,
  ],
})
export class IdentityAccessModule {}
