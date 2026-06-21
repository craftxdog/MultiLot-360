import { Global, Module } from '@nestjs/common';
import { EnvConfigModule } from '../../config/config.module';
import { MAILER_PORT } from './domain';
import { MailerSendMailerService } from './mailersend-mailer.service';
import { TemplateRendererService } from './template-renderer.service';

@Global()
@Module({
  imports: [EnvConfigModule],
  providers: [
    TemplateRendererService,
    MailerSendMailerService,
    {
      provide: MAILER_PORT,
      useExisting: MailerSendMailerService,
    },
  ],
  exports: [MAILER_PORT, MailerSendMailerService, TemplateRendererService],
})
export class MailerModule {}
