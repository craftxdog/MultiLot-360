import {
  AccessModule,
  AccessPermission,
  AccessRole,
  AccessUserRole,
} from '../entities';

export const ACCESS_CONTROL_REPOSITORY = Symbol('ACCESS_CONTROL_REPOSITORY');

export type ReplaceRolePermissionsInput = {
  roleId: string;
  permissions: Array<
    Pick<
      AccessPermission,
      'moduleCode' | 'canRead' | 'canCreate' | 'canUpdate' | 'canDelete'
    >
  >;
};

export interface AccessControlRepository {
  listModules(search?: string): Promise<AccessModule[]>;
  listRoles(search?: string): Promise<AccessRole[]>;
  getRole(roleId: string): Promise<AccessRole | null>;
  createRole(name: string): Promise<AccessRole>;
  replaceRolePermissions(
    input: ReplaceRolePermissionsInput,
  ): Promise<AccessRole>;
  assignUserRole(userId: string, roleId: string): Promise<AccessUserRole>;
}
