import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiOkResponse, SwaggerModule } from '@nestjs/swagger';
import { BILLING_AUTH_MODE_KEY } from '../common/constants';
import { BillingAuth } from '../common/decorators';
import {
  AuthMeResponseDto,
  AuthSessionResponseDto,
} from '../modules/identity-access/presentation/http/dto';
import { buildSwaggerConfig } from './swagger.config';

@Controller('swagger-contract')
class SwaggerContractController {
  @Get('public')
  publicRoute() {
    return {};
  }

  @BillingAuth('portal')
  @Get('protected')
  protectedRoute() {
    return {};
  }

  @Get('session')
  @ApiOkResponse({ type: AuthSessionResponseDto })
  session() {
    return {};
  }

  @Get('me')
  @ApiOkResponse({ type: AuthMeResponseDto })
  me() {
    return {};
  }
}

describe('Swagger contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SwaggerContractController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents bearer only on operations protected with BillingAuth', () => {
    const document = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig('MultiLot 360 test'),
    );

    expect(
      document.paths['/swagger-contract/protected']?.get?.security,
    ).toEqual([{ bearer: [] }]);
    expect(
      document.paths['/swagger-contract/public']?.get?.security,
    ).toBeUndefined();

    const handler = Reflect.get(
      SwaggerContractController.prototype,
      'protectedRoute',
    ) as object;
    expect(Reflect.getMetadata(BILLING_AUTH_MODE_KEY, handler)).toBe('portal');
  });

  it('documents the direct session user with its nested tenant context', () => {
    const document = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig('MultiLot 360 test'),
    );
    const schemas = document.components?.schemas;

    expect(schemas?.AuthSessionResponseDto).toMatchObject({
      properties: {
        user: { $ref: '#/components/schemas/AuthSessionUserDto' },
      },
    });
    expect(schemas?.AuthSessionUserDto).toMatchObject({
      properties: {
        role: { $ref: '#/components/schemas/AuthSessionRoleDto' },
        tenant: { $ref: '#/components/schemas/AuthSessionTenantDto' },
        seller: { $ref: '#/components/schemas/AuthSessionSellerDto' },
      },
    });
  });

  it('documents the flat tenant context returned by auth/me', () => {
    const document = SwaggerModule.createDocument(
      app,
      buildSwaggerConfig('MultiLot 360 test'),
    );

    const schema = document.components?.schemas?.AuthMeUserDto;
    expect(schema).toHaveProperty('properties.email');
    expect(schema).toHaveProperty('properties.active');
    expect(schema).toHaveProperty('properties.tenantId');
    expect(schema).toHaveProperty('properties.tenantSlug');
    expect(schema).toHaveProperty('properties.membershipId');
    expect(schema).toHaveProperty('properties.isOwner');
  });

  it('registers descriptions for notifications and access control tags', () => {
    const config = buildSwaggerConfig('MultiLot 360 test');
    const tags = Object.fromEntries(
      (config.tags ?? []).map((tag) => [tag.name, tag.description]),
    );

    expect(tags.Notifications).toBeTruthy();
    expect(tags['System parameters - access control']).toBeTruthy();
  });
});
