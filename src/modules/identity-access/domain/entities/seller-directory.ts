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
  createdAt: Date;
  updatedAt: Date;
};
