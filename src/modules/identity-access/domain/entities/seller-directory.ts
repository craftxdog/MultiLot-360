export type SellerDirectoryItem = {
  id: string;
  userId: string;
  username: string;
  userName: string | null;
  roleId: string;
  roleName: string;
  name: string;
  documentId: string;
  phone: string | null;
  address: string | null;
  active: boolean;
  userActive: boolean;
  deletedAt: Date | null;
  deletionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type SellerDeletionMode = 'soft' | 'hard';

export type SellerDeletionTarget = {
  sellerId: string;
  userId: string;
  username: string;
  sellerName: string;
  authUserId: string | null;
};

export type SellerDeletionResult = SellerDeletionTarget & {
  mode: SellerDeletionMode;
  authUserDeleted: boolean;
  deletedAt: Date;
};
