import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { HealthService } from './application';
import { HealthController } from './presentation';

@Module({
  imports: [DatabaseModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
