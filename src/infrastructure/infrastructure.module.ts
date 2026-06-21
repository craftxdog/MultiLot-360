import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { MailerModule } from './mailer';

@Global()
@Module({
  imports: [DatabaseModule, MailerModule],
  exports: [DatabaseModule, MailerModule],
})
export class InfrastructureModule {}
