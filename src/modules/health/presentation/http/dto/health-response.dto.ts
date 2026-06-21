import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiPropertyOptional()
  details?: string;
}

@ApiExtraModels(HealthCheckDto)
export class HealthResponseDto {
  @ApiProperty({ enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty()
  service: string;

  @ApiProperty()
  timestamp: string;

  @ApiPropertyOptional({
    additionalProperties: { $ref: getSchemaPath(HealthCheckDto) },
    type: 'object',
  })
  checks?: Record<string, HealthCheckDto>;
}
