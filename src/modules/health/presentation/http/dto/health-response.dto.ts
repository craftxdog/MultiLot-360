import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiPropertyOptional()
  details?: string;
}

export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty()
  service: string;

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional({
    additionalProperties: { $ref: '#/components/schemas/HealthCheckDto' },
  })
  checks?: Record<string, HealthCheckDto>;
}
