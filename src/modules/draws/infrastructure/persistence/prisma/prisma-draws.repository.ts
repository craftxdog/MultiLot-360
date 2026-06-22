import { Injectable } from '@nestjs/common';
import { Prisma, turno_estado } from '@prisma/client';
import { PrismaService } from '../../../../../infrastructure/database/prisma';
import { DrawConfiguration, DrawShift } from '../../../domain/entities';
import {
  CreateDrawConfigurationInput,
  DrawsRepository,
  ListActiveDrawShiftsQuery,
  ListDrawConfigurationsQuery,
  ListDrawShiftsQuery,
  OpenDrawShiftInput,
  UpdateDrawConfigurationInput,
} from '../../../domain/ports';

const shiftInclude = {
  sorteos_config: true,
} satisfies Prisma.turnosInclude;

type DrawShiftRecord = Prisma.turnosGetPayload<{
  include: typeof shiftInclude;
}>;

@Injectable()
export class PrismaDrawsRepository implements DrawsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createConfiguration(
    input: CreateDrawConfigurationInput,
  ): Promise<DrawConfiguration> {
    try {
      const configuration = await this.prisma.sorteos_config.create({
        data: {
          codigo: input.code,
          hora: this.toTimeDate(input.time),
          solo_martes: input.tuesdayOnly ?? false,
          lock_segundos_antes: input.lockSecondsBefore ?? 60,
          reopen_segundos_despues: input.reopenSecondsAfter ?? 600,
          activo: input.active ?? true,
        },
      });

      return this.mapConfiguration(configuration);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async listConfigurations(
    query: ListDrawConfigurationsQuery,
  ): Promise<DrawConfiguration[]> {
    const configurations = await this.prisma.sorteos_config.findMany({
      where: {
        ...(query.active !== undefined && { activo: query.active }),
      },
      orderBy: [{ hora: 'asc' }, { codigo: 'asc' }],
    });

    return configurations.map((configuration) =>
      this.mapConfiguration(configuration),
    );
  }

  async findConfigurationById(
    configurationId: string,
  ): Promise<DrawConfiguration | null> {
    const configuration = await this.prisma.sorteos_config.findUnique({
      where: {
        id: configurationId,
      },
    });

    return configuration ? this.mapConfiguration(configuration) : null;
  }

  async updateConfiguration(
    input: UpdateDrawConfigurationInput,
  ): Promise<DrawConfiguration | null> {
    const configuration = await this.prisma.sorteos_config.findUnique({
      where: {
        id: input.configurationId,
      },
    });

    if (!configuration) {
      return null;
    }

    try {
      const updatedConfiguration = await this.prisma.sorteos_config.update({
        where: {
          id: input.configurationId,
        },
        data: {
          ...(input.code !== undefined && { codigo: input.code }),
          ...(input.time !== undefined && {
            hora: this.toTimeDate(input.time),
          }),
          ...(input.tuesdayOnly !== undefined && {
            solo_martes: input.tuesdayOnly,
          }),
          ...(input.lockSecondsBefore !== undefined && {
            lock_segundos_antes: input.lockSecondsBefore,
          }),
          ...(input.reopenSecondsAfter !== undefined && {
            reopen_segundos_despues: input.reopenSecondsAfter,
          }),
          ...(input.active !== undefined && { activo: input.active }),
        },
      });

      return this.mapConfiguration(updatedConfiguration);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async openShift(input: OpenDrawShiftInput): Promise<DrawShift> {
    try {
      const date = this.toDateOnly(input.date);
      const existingShift = await this.prisma.turnos.findUnique({
        where: {
          fecha_config_id: {
            fecha: date,
            config_id: input.configurationId,
          },
        },
        include: shiftInclude,
      });

      if (existingShift) {
        return this.mapShift(existingShift);
      }

      const shift = await this.prisma.turnos.create({
        data: {
          fecha: date,
          config_id: input.configurationId,
          estado: turno_estado.ABIERTO,
        },
        include: shiftInclude,
      });

      return this.mapShift(shift);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async closeShift(shiftId: string): Promise<DrawShift | null> {
    try {
      const existingShift = await this.prisma.turnos.findUnique({
        where: {
          id: shiftId,
        },
        include: shiftInclude,
      });

      if (!existingShift) {
        return null;
      }

      if (existingShift.estado === turno_estado.CERRADO) {
        return this.mapShift(existingShift);
      }

      const shift = await this.prisma.turnos.update({
        where: {
          id: shiftId,
        },
        data: {
          estado: turno_estado.CERRADO,
        },
        include: shiftInclude,
      });

      return this.mapShift(shift);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async blockShift(shiftId: string): Promise<DrawShift | null> {
    try {
      return this.transitionShift(shiftId, turno_estado.BLOQUEO, [
        turno_estado.ABIERTO,
        turno_estado.BLOQUEO,
      ]);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async reopenShift(shiftId: string): Promise<DrawShift | null> {
    try {
      return this.transitionShift(shiftId, turno_estado.ABIERTO, [
        turno_estado.ABIERTO,
        turno_estado.BLOQUEO,
      ]);
    } catch (error) {
      throw this.toDrawsError(error);
    }
  }

  async listShifts(query: ListDrawShiftsQuery): Promise<DrawShift[]> {
    const shifts = await this.prisma.turnos.findMany({
      where: {
        ...(query.date && { fecha: this.toDateOnly(query.date) }),
        ...(query.status && { estado: query.status }),
      },
      include: shiftInclude,
      orderBy: [{ fecha: 'desc' }, { sorteos_config: { hora: 'asc' } }],
    });

    return shifts.map((shift) => this.mapShift(shift));
  }

  async listActiveShifts(
    query: ListActiveDrawShiftsQuery,
  ): Promise<DrawShift[]> {
    const shifts = await this.prisma.turnos.findMany({
      where: {
        ...(query.date && { fecha: this.toDateOnly(query.date) }),
        estado: {
          in: [turno_estado.ABIERTO, turno_estado.BLOQUEO],
        },
      },
      include: shiftInclude,
      orderBy: [{ fecha: 'desc' }, { sorteos_config: { hora: 'asc' } }],
    });

    return shifts.map((shift) => this.mapShift(shift));
  }

  private async transitionShift(
    shiftId: string,
    nextStatus: turno_estado,
    allowedStatuses: turno_estado[],
  ): Promise<DrawShift | null> {
    const existingShift = await this.prisma.turnos.findUnique({
      where: {
        id: shiftId,
      },
      include: shiftInclude,
    });

    if (!existingShift) {
      return null;
    }

    if (!allowedStatuses.includes(existingShift.estado)) {
      throw new Error(
        `Cannot transition draw shift from ${existingShift.estado} to ${nextStatus}`,
      );
    }

    if (existingShift.estado === nextStatus) {
      return this.mapShift(existingShift);
    }

    const shift = await this.prisma.turnos.update({
      where: {
        id: shiftId,
      },
      data: {
        estado: nextStatus,
      },
      include: shiftInclude,
    });

    return this.mapShift(shift);
  }

  private mapShift(shift: DrawShiftRecord): DrawShift {
    return {
      id: shift.id,
      date: this.formatDateOnly(shift.fecha),
      status: shift.estado,
      createdAt: shift.creado_en,
      updatedAt: shift.actualizado_en,
      configuration: this.mapConfiguration(shift.sorteos_config),
    };
  }

  private mapConfiguration(
    configuration: Prisma.sorteos_configGetPayload<Record<string, never>>,
  ): DrawConfiguration {
    return {
      id: configuration.id,
      code: configuration.codigo,
      time: this.formatTime(configuration.hora),
      tuesdayOnly: configuration.solo_martes,
      lockSecondsBefore: configuration.lock_segundos_antes,
      reopenSecondsAfter: configuration.reopen_segundos_despues,
      active: configuration.activo,
      createdAt: configuration.creado_en,
      updatedAt: configuration.actualizado_en,
    };
  }

  private toTimeDate(time: string): Date {
    const [hours = 0, minutes = 0, seconds = 0] = time
      .split(':')
      .map((part) => Number(part));

    return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
  }

  private formatTime(time: Date): string {
    return time.toISOString().slice(11, 19);
  }

  private toDateOnly(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  private formatDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private toDrawsError(error: unknown): Error {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return new Error('Draw resource already exists');
      }

      if (error.code === 'P2003') {
        return new Error('Draw resource references an invalid record');
      }
    }

    return error instanceof Error ? error : new Error('Could not persist draw');
  }
}
