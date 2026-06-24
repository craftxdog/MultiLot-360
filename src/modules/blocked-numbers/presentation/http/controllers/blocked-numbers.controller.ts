import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  CurrentUser,
  Permissions,
  RequireModules,
  SYSTEM_MODULES,
} from '../../../../../common';
import {
  CreateBlockedNumbersUseCase,
  DeleteBlockedNumberUseCase,
  GetBlockedNumberUseCase,
  ListBlockedNumbersUseCase,
} from '../../../application';
import {
  BlockedNumberResponseDto,
  CreateBlockedNumbersDto,
  ListBlockedNumbersQueryDto,
} from '../dto';
import { BlockedNumbersHttpMapper } from '../mappers';

@ApiTags('Blocked numbers')
@ApiBearerAuth()
@Controller('blocked-numbers')
@RequireModules(SYSTEM_MODULES.numerosBloqueados)
export class BlockedNumbersController {
  constructor(
    private readonly createBlockedNumbers: CreateBlockedNumbersUseCase,
    private readonly listBlockedNumbers: ListBlockedNumbersUseCase,
    private readonly getBlockedNumber: GetBlockedNumberUseCase,
    private readonly deleteBlockedNumber: DeleteBlockedNumberUseCase,
  ) {}

  @Get()
  @Permissions('numeros_bloqueados.read')
  @ApiOkResponse({ type: [BlockedNumberResponseDto] })
  list(@Query() query: ListBlockedNumbersQueryDto) {
    return this.listBlockedNumbers.execute(
      BlockedNumbersHttpMapper.toListQuery(query),
    );
  }

  @Post()
  @Permissions('numeros_bloqueados.create')
  @ApiCreatedResponse({ type: [BlockedNumberResponseDto] })
  create(
    @Body() body: CreateBlockedNumbersDto,
    @CurrentUser('id') createdByUserId?: string,
  ) {
    return this.createBlockedNumbers.execute(
      BlockedNumbersHttpMapper.toCreateCommand(body, createdByUserId),
    );
  }

  @Get(':blockId')
  @Permissions('numeros_bloqueados.read')
  @ApiParam({ name: 'blockId', format: 'uuid' })
  @ApiOkResponse({ type: BlockedNumberResponseDto })
  get(
    @Param('blockId', new ParseUUIDPipe({ version: '4' }))
    blockId: string,
  ) {
    return this.getBlockedNumber.execute({ blockId });
  }

  @Delete(':blockId')
  @HttpCode(HttpStatus.OK)
  @Permissions('numeros_bloqueados.delete')
  @ApiParam({ name: 'blockId', format: 'uuid' })
  @ApiOkResponse({ type: BlockedNumberResponseDto })
  delete(
    @Param('blockId', new ParseUUIDPipe({ version: '4' }))
    blockId: string,
  ) {
    return this.deleteBlockedNumber.execute(
      BlockedNumbersHttpMapper.toDeleteCommand(blockId),
    );
  }
}
