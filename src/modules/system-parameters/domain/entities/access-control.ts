export type AccessPermission = {
  moduleId: string;
  moduleCode: string;
  moduleDescription: string | null;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

export type AccessModule = {
  id: string;
  code: string;
  description: string | null;
  roleCount: number;
};

export type AccessRole = {
  id: string;
  name: string;
  createdAt: Date;
  userCount: number;
  permissions: AccessPermission[];
};

export type AccessUserRole = {
  userId: string;
  username: string;
  name: string | null;
  roleId: string;
  roleName: string;
  updatedAt: Date;
};
