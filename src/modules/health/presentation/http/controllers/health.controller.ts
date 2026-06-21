import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../../../../common';
import { HealthService } from '../../../application/health.service';
import { HealthResponseDto } from '../dto';

@Public()
@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HealthResponseDto })
  liveness(): HealthResponseDto {
    return this.healthService.liveness();
  }

  @Get('ready')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: HealthResponseDto })
  readiness(): Promise<HealthResponseDto> {
    return this.healthService.readiness();
  }
}
