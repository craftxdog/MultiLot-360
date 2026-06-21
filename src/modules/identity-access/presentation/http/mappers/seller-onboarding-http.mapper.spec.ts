import { AuthenticatedUserContext } from '../../../../../common/interfaces';
import { SellerOnboardingHttpMapper } from './seller-onboarding-http.mapper';

describe('SellerOnboardingHttpMapper', () => {
  const admin: AuthenticatedUserContext = {
    id: 'admin-id',
    authUserId: 'auth-admin-id',
    username: 'admin',
    roleId: 'role-id',
    roleName: 'ADMIN',
  };

  it('maps create invitation dto into an application command', () => {
    expect(
      SellerOnboardingHttpMapper.toCreateInvitationCommand(
        {
          email: 'seller@example.com',
          username: 'seller.01',
          sellerName: 'Seller One',
          documentId: '001-010190-0001A',
          roleName: 'vendedor',
        },
        admin,
      ),
    ).toMatchObject({
      email: 'seller@example.com',
      username: 'seller.01',
      sellerName: 'Seller One',
      adminUserId: 'admin-id',
      adminName: 'admin',
    });
  });

  it('maps query dto into an application query', () => {
    expect(
      SellerOnboardingHttpMapper.toListInvitationsQuery({
        status: 'PENDIENTE',
        page: 1,
        limit: 25,
        sortBy: 'creado_en',
        sortDirection: 'desc',
      }),
    ).toEqual({
      status: 'PENDIENTE',
      page: 1,
      limit: 25,
      sortBy: 'creado_en',
      sortDirection: 'desc',
    });
  });
});
