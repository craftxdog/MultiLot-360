import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { AuditLogsModule } from '../audit-logs';
import {
  AccessTokenVerifierService,
  AdminResetPasswordUseCase,
  ConfirmPasswordResetUseCase,
  ConfirmSellerAccessCodeUseCase,
  CreateSellerInvitationUseCase,
  ListSellerInvitationsUseCase,
  ListSellersUseCase,
  LoginUseCase,
  LogoutUseCase,
  RefreshSessionUseCase,
  RequestPasswordResetUseCase,
  ResendSellerAccessCodeUseCase,
  ResolveRequestIdentityUseCase,
  RevokeSellerInvitationUseCase,
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
  imports: [
    DatabaseModule,
    AuditLogsModule,
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ name: 'passwordReset', ttl: 60_000, limit: 3 }]),
  ],
  controllers: [AuthController, AuthMeController, SellerOnboardingController],
  providers: [
    PrismaAuthAccountRepository,
    PrismaIdentityAccessRepository,
    PrismaSellerOnboardingRepository,
    AccessTokenVerifierService,
    AdminResetPasswordUseCase,
    SellerAccessCodeService,
    SupabaseAuthProviderService,
    ConfirmSellerAccessCodeUseCase,
    ConfirmPasswordResetUseCase,
    CreateSellerInvitationUseCase,
    ListSellerInvitationsUseCase,
    ListSellersUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    RequestPasswordResetUseCase,
    ResendSellerAccessCodeUseCase,
    RevokeSellerInvitationUseCase,
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
    AccessTokenVerifierService,
    AdminResetPasswordUseCase,
    ConfirmSellerAccessCodeUseCase,
    ConfirmPasswordResetUseCase,
    CreateSellerInvitationUseCase,
    ListSellerInvitationsUseCase,
    ListSellersUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshSessionUseCase,
    RequestPasswordResetUseCase,
    ResendSellerAccessCodeUseCase,
    RevokeSellerInvitationUseCase,
    ResolveRequestIdentityUseCase,
    SignupAdminUseCase,
  ],
})
export class IdentityAccessModule {}
