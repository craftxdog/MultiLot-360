import {
  IntegrationEventInput,
  IntegrationEventPublisher,
  OPERATIONAL_EVENTS,
} from '../../../../shared-kernel';
import { AccessControlRepository } from '../../domain';
import {
  AssignUserRoleUseCase,
  CreateAccessRoleUseCase,
  ReplaceAccessRolePermissionsUseCase,
} from './access-control.use-cases';

const role = {
  id: 'role-id',
  name: 'vendedor',
  createdAt: new Date('2026-07-01T00:00:00.000Z'),
  userCount: 1,
  permissions: [
    {
      moduleId: 'module-id',
      moduleCode: 'TURNOS',
      moduleDescription: 'Turnos',
      canRead: true,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    },
  ],
};

describe('Access control use cases', () => {
  const assignUserRole = jest.fn<
    ReturnType<AccessControlRepository['assignUserRole']>,
    Parameters<AccessControlRepository['assignUserRole']>
  >();
  const publishedEvents: IntegrationEventInput[] = [];
  const repository = {
    listModules: jest.fn(),
    listRoles: jest.fn(),
    getRole: jest.fn(),
    createRole: jest.fn(),
    replaceRolePermissions: jest.fn(),
    assignUserRole,
  } as jest.Mocked<AccessControlRepository>;
  const publisher: IntegrationEventPublisher = {
    publish: (event) => {
      publishedEvents.push(event);
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    publishedEvents.length = 0;
  });

  it('normalizes new role names to the uppercase database invariant', async () => {
    repository.createRole.mockResolvedValue({
      ...role,
      name: 'QA SUPERVISOR-01',
    });
    const useCase = new CreateAccessRoleUseCase(repository);

    const result = await useCase.execute({ name: '  qa supervisor-01  ' });

    expect(result.isSuccess).toBe(true);
    expect(repository.createRole.mock.calls).toEqual([['QA SUPERVISOR-01']]);
  });

  it('replaces permissions and notifies connected users in the role', async () => {
    repository.replaceRolePermissions.mockResolvedValue(role);
    const useCase = new ReplaceAccessRolePermissionsUseCase(
      repository,
      publisher,
    );
    const command = {
      roleId: role.id,
      permissions: role.permissions.map((permission) => ({
        moduleCode: permission.moduleCode,
        canRead: permission.canRead,
        canCreate: permission.canCreate,
        canUpdate: permission.canUpdate,
        canDelete: permission.canDelete,
      })),
    };

    const result = await useCase.execute(command);

    expect(result.isSuccess).toBe(true);
    const published = publishedEvents[0];
    if (!published) throw new Error('Expected a published event');
    expect(published.name).toBe(
      OPERATIONAL_EVENTS.accessRolePermissionsUpdated,
    );
    expect(published.audience.roles).toEqual(['vendedor']);
  });

  it('prevents an administrator from removing their own ADMIN role', async () => {
    repository.getRole.mockResolvedValue(role);
    const useCase = new AssignUserRoleUseCase(repository, publisher);

    const result = await useCase.execute({
      userId: 'admin-id',
      actorUserId: 'admin-id',
      roleId: role.id,
    });

    expect(result.isFailure).toBe(true);
    expect(assignUserRole).not.toHaveBeenCalled();
  });

  it('assigns a role and emits a user-scoped refresh event', async () => {
    repository.assignUserRole.mockResolvedValue({
      userId: 'seller-user-id',
      username: 'seller@example.com',
      name: 'Seller',
      roleId: role.id,
      roleName: role.name,
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    });
    const useCase = new AssignUserRoleUseCase(repository, publisher);

    const result = await useCase.execute({
      userId: 'seller-user-id',
      actorUserId: 'admin-id',
      roleId: role.id,
    });

    expect(result.isSuccess).toBe(true);
    const published = publishedEvents[0];
    if (!published) throw new Error('Expected a published event');
    expect(published.name).toBe(OPERATIONAL_EVENTS.accessUserRoleUpdated);
    expect(published.audience).toEqual({
      modules: ['roles'],
      userIds: ['seller-user-id'],
    });
  });
});
