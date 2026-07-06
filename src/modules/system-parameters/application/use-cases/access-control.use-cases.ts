import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  ErrorFactory,
  INTEGRATION_EVENT_PUBLISHER,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
  Result,
  UseCase,
  operationalAudience,
} from '../../../../shared-kernel';
import {
  AccessModule,
  AccessRole,
  AccessUserRole,
} from '../../domain/entities';
import {
  ACCESS_CONTROL_REPOSITORY,
  AccessControlRepository,
  ReplaceRolePermissionsInput,
} from '../../domain/ports';

export type ListAccessQuery = { search?: string };

@Injectable()
export class ListAccessModulesUseCase extends UseCase<
  ListAccessQuery,
  AccessModule[],
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
  ) {
    super();
  }

  async execute(
    input: ListAccessQuery,
  ): Promise<Result<AccessModule[], AppError>> {
    try {
      return Result.success(await this.repository.listModules(input.search));
    } catch (error) {
      return ErrorFactory.useCase('Could not list access modules', error);
    }
  }
}

@Injectable()
export class ListAccessRolesUseCase extends UseCase<
  ListAccessQuery,
  AccessRole[],
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
  ) {
    super();
  }

  async execute(
    input: ListAccessQuery,
  ): Promise<Result<AccessRole[], AppError>> {
    try {
      return Result.success(await this.repository.listRoles(input.search));
    } catch (error) {
      return ErrorFactory.useCase('Could not list access roles', error);
    }
  }
}

@Injectable()
export class GetAccessRoleUseCase extends UseCase<
  { roleId: string },
  AccessRole,
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
  ) {
    super();
  }

  async execute(input: {
    roleId: string;
  }): Promise<Result<AccessRole, AppError>> {
    try {
      const role = await this.repository.getRole(input.roleId);
      return role
        ? Result.success(role)
        : ErrorFactory.useCase('Role not found', undefined, 404);
    } catch (error) {
      return ErrorFactory.useCase('Could not get access role', error);
    }
  }
}

@Injectable()
export class CreateAccessRoleUseCase extends UseCase<
  { name: string },
  AccessRole,
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
  ) {
    super();
  }

  async execute(input: {
    name: string;
  }): Promise<Result<AccessRole, AppError>> {
    try {
      return Result.success(
        await this.repository.createRole(input.name.trim()),
      );
    } catch (error) {
      return ErrorFactory.useCase(
        error instanceof Error ? error.message : 'Could not create role',
        error,
        error instanceof Error && error.message.includes('already exists')
          ? 409
          : undefined,
      );
    }
  }
}

export type ReplaceAccessRolePermissionsCommand = ReplaceRolePermissionsInput;

@Injectable()
export class ReplaceAccessRolePermissionsUseCase extends UseCase<
  ReplaceAccessRolePermissionsCommand,
  AccessRole,
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: ReplaceAccessRolePermissionsCommand,
  ): Promise<Result<AccessRole, AppError>> {
    try {
      const role = await this.repository.replaceRolePermissions(input);
      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.accessRolePermissionsUpdated,
        aggregateId: role.id,
        audience: operationalAudience.accessRole(role.name),
        payload: {
          roleId: role.id,
          roleName: role.name,
          permissions: role.permissions,
        },
      });
      return Result.success(role);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not replace role permissions';
      return ErrorFactory.useCase(
        message,
        error,
        message.includes('not found')
          ? 404
          : message.includes('must retain')
            ? 422
            : undefined,
      );
    }
  }
}

export type AssignUserRoleCommand = {
  userId: string;
  roleId: string;
  actorUserId: string;
};

@Injectable()
export class AssignUserRoleUseCase extends UseCase<
  AssignUserRoleCommand,
  AccessUserRole,
  AppError
> {
  constructor(
    @Inject(ACCESS_CONTROL_REPOSITORY)
    private readonly repository: AccessControlRepository,
    @Inject(INTEGRATION_EVENT_PUBLISHER)
    private readonly eventPublisher?: IntegrationEventPublisher,
  ) {
    super();
  }

  async execute(
    input: AssignUserRoleCommand,
  ): Promise<Result<AccessUserRole, AppError>> {
    try {
      if (input.userId === input.actorUserId) {
        const targetRole = await this.repository.getRole(input.roleId);
        if (!targetRole) {
          return ErrorFactory.useCase('Role not found', undefined, 404);
        }
        if (targetRole.name.toUpperCase() !== 'ADMIN') {
          return ErrorFactory.useCase(
            'Administrators cannot remove their own ADMIN role',
            undefined,
            422,
          );
        }
      }
      const assignment = await this.repository.assignUserRole(
        input.userId,
        input.roleId,
      );
      this.eventPublisher?.publish({
        name: OPERATIONAL_EVENTS.accessUserRoleUpdated,
        aggregateId: assignment.userId,
        audience: operationalAudience.accessUser(assignment.userId),
        payload: assignment,
      });
      return Result.success(assignment);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not assign user role';
      return ErrorFactory.useCase(
        message,
        error,
        message.includes('not found') ? 404 : undefined,
      );
    }
  }
}
