import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { BillingAuth, Public } from '../../common';
import {
  BankTransferSubmissionDto,
  BillingCycleDto,
  BillingPlansQueryDto,
  DevelopmentBillingCompleteDto,
  PaypalWebhookDto,
  PaidCompanySignupDto,
  ReviewBankTransferDto,
  TransferQueueQueryDto,
} from './saas-billing.dto';
import { SaasBillingService, UploadedEvidence } from './saas-billing.service';

@ApiTags('SaaS billing')
@Controller('billing')
export class SaasBillingController {
  constructor(private readonly billing: SaasBillingService) {}

  @Public()
  @Get('plans')
  @ApiOkResponse({ description: 'Active AlphaBy subscription catalog.' })
  plans(@Query() query: BillingPlansQueryDto) {
    return this.billing.listPlans(query.channel);
  }

  @Public()
  @Post('signup')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 3_600_000 } })
  @ApiCreatedResponse({
    description: 'Pending tenant created; email verification is required.',
  })
  signup(@Body() body: PaidCompanySignupDto) {
    return this.billing.signup(body);
  }

  @BillingAuth('portal')
  @Get('portal')
  portal() {
    return this.billing.getPortal();
  }

  @BillingAuth('portal')
  @Post('portal/invoices/initial')
  @ApiCreatedResponse({ description: 'Creates or returns the first charge.' })
  initialInvoice() {
    return this.billing.ensureInitialInvoice();
  }

  @BillingAuth('portal')
  @Post('portal/paypal/checkout')
  @ApiCreatedResponse({ description: 'Optional PayPal approval URL.' })
  paypalCheckout() {
    return this.billing.startPaypalCheckout();
  }

  @BillingAuth('portal')
  @Post('portal/transfers')
  @ApiCreatedResponse({ description: 'Creates a transfer declaration.' })
  transfer(@Body() body: BankTransferSubmissionDto) {
    return this.billing.createTransferSubmission(body);
  }

  @BillingAuth('portal')
  @Post('portal/transfers/:id/evidence')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  uploadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: UploadedEvidence | undefined,
  ) {
    return this.billing.uploadEvidence(id, file);
  }

  @BillingAuth('platform')
  @Get('admin/transfers')
  transferQueue(@Query() query: TransferQueueQueryDto) {
    return this.billing.listTransferQueue(query.status, query.limit);
  }

  @BillingAuth('platform')
  @Post('admin/transfers/:id/review')
  reviewTransfer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReviewBankTransferDto,
  ) {
    return this.billing.reviewTransfer(id, body);
  }

  @Public()
  @Post('webhooks/paypal')
  @HttpCode(HttpStatus.OK)
  paypalWebhook(@Req() request: Request, @Body() body: PaypalWebhookDto) {
    return this.billing.handlePaypalWebhook(request.headers, body);
  }

  @Public()
  @Post('internal/cycle')
  @HttpCode(HttpStatus.OK)
  billingCycle(
    @Headers('x-billing-worker-secret') secret: string | undefined,
    @Body() body: BillingCycleDto,
  ) {
    return this.billing.runBillingCycle(secret, body.now);
  }

  @Public()
  @Post('development/complete')
  @HttpCode(HttpStatus.OK)
  developmentComplete(
    @Headers('x-development-billing-secret') secret: string | undefined,
    @Body() body: DevelopmentBillingCompleteDto,
  ) {
    return this.billing.completeDevelopmentSignup(
      secret,
      body.onboardingId,
      body.providerSubscriptionId,
    );
  }
}
