import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { BillingProviderService } from './billing-provider.service';
import { SaasBillingController } from './saas-billing.controller';
import { SaasBillingService } from './saas-billing.service';

@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }])],
  controllers: [SaasBillingController],
  providers: [BillingProviderService, SaasBillingService],
  exports: [SaasBillingService],
})
export class SaasBillingModule {}
