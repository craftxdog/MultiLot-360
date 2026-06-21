export type PermissionAction = 'read' | 'create' | 'update' | 'delete';
export type PermissionKey = `${string}.${PermissionAction}`;

export type IdentityRole = {
  id: string;
  name: string;
};

export type IdentitySeller = {
  id: string;
  userId: string;
  name: string;
  active: boolean;
};

export type IdentityUser = {
  id: string;
  authUserId: string;
  username: string;
  name?: string | null;
  active: boolean;
  role: IdentityRole;
  modules: string[];
  permissions: PermissionKey[];
  seller?: IdentitySeller;
};
