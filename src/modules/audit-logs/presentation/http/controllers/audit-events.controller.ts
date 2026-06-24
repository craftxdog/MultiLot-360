import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  GetAuditEventUseCase,
  ListAuditEventsUseCase,
} from '../../../application';
import { AuditEventResponseDto, ListAuditEventsQueryDto } from '../dto';
import { AuditEventsHttpMapper } from '../mappers';

@ApiTags('Audit events')
@ApiBearerAuth()
@Controller('audit-events')
@RequireModules(SYSTEM_MODULES.auditoria)
export class AuditEventsController {
  constructor(
    private readonly listAuditEvents: ListAuditEventsUseCase,
    private readonly getAuditEvent: GetAuditEventUseCase,
  ) {}

  @Get()
  @Permissions('auditoria.read')
  @ApiOkResponse({ type: [AuditEventResponseDto] })
  list(@Query() query: ListAuditEventsQueryDto) {
    return this.listAuditEvents.execute(
      AuditEventsHttpMapper.toListQuery(query),
    );
  }

  @Get(':eventId')
  @Permissions('auditoria.read')
  @ApiParam({ name: 'eventId', example: '1' })
  @ApiOkResponse({ type: AuditEventResponseDto })
  get(@Param('eventId') eventId: string) {
    return this.getAuditEvent.execute({ eventId });
  }
}
