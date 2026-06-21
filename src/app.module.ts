import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EnvConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';

@Module({
  imports: [EnvConfigModule, InfrastructureModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
