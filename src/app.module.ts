import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common';
import { EnvConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { IdentityAccessModule } from './modules/identity-access';

@Module({
  imports: [
    EnvConfigModule,
    InfrastructureModule,
    CommonModule,
    IdentityAccessModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
