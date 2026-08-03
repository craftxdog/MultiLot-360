import { ForbiddenException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma';
import { TenantExecutionContextService } from './tenant-execution-context.service';

export type ActiveTenantContext = {
  authUserId: string;
  id: string;
  slug: string;
  name: string;
  status: string;
  membershipId: string;
  profileId: string;
};

type ResolvedContextRow = {
  profile_id: string;
  tenant_id: string;
  membership_id: string;
};

type AuthenticationContextRow = ResolvedContextRow & {
  billing_only: boolean;
};

export type PlatformBillingContext = {
  profileId: string;
  platformAdminId: string;
};

@Injectable()
export class TenantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly executionContext: TenantExecutionContextService,
  ) {}

  async activate(
    authUserId: string,
    tenantSelector?: string,
  ): Promise<ActiveTenantContext> {
    if (!this.prisma.hasRequestTransaction()) {
      throw new ForbiddenException('Tenant transaction is required');
    }

    let rows: ResolvedContextRow[];
    try {
      rows = await this.prisma.$queryRaw<ResolvedContextRow[]>(
        Prisma.sql`SELECT * FROM app_private.resolve_request_context(
          ${authUserId}::uuid,
          ${tenantSelector ?? null}::text
        )`,
      );
    } catch {
      throw new ForbiddenException('No active tenant membership was found');
    }
    const resolved = rows[0];
    if (!resolved) {
      throw new ForbiddenException('No active tenant membership was found');
    }

    await this.prisma.$executeRaw(
      Prisma.sql`SELECT app_private.set_request_context(
        ${authUserId}::uuid,
        ${resolved.tenant_id}::uuid,
        ${resolved.profile_id}::uuid,
        ${resolved.membership_id}::uuid
      )`,
    );

    const tenant = await this.prisma.tenants.findUnique({
      where: { id: resolved.tenant_id },
      select: { id: true, slug: true, nombre: true, estado: true },
    });
    if (!tenant) {
      throw new ForbiddenException('Tenant is not available');
    }

    const active = {
      authUserId,
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.nombre,
      status: tenant.estado,
      membershipId: resolved.membership_id,
      profileId: resolved.profile_id,
    };
    this.executionContext.set(active);
    return active;
  }

  async activateBilling(
    authUserId: string,
    tenantSelector?: string,
  ): Promise<ActiveTenantContext> {
    return this.activateWithResolver(authUserId, tenantSelector, 'billing');
  }

  async activateForAuthentication(
    authUserId: string,
    tenantSelector?: string,
  ): Promise<ActiveTenantContext> {
    if (!this.prisma.hasRequestTransaction()) {
      throw new ForbiddenException('Tenant transaction is required');
    }
    let rows: AuthenticationContextRow[];
    try {
      rows = await this.prisma.$queryRaw<AuthenticationContextRow[]>(
        Prisma.sql`SELECT * FROM app_private.set_authentication_request_context(
          ${authUserId}::uuid,
          ${tenantSelector ?? null}::text
        )`,
      );
    } catch {
      throw new ForbiddenException('No authentication membership was found');
    }
    const resolved = rows[0];
    if (!resolved) {
      throw new ForbiddenException('No authentication membership was found');
    }
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: resolved.tenant_id },
      select: { id: true, slug: true, nombre: true, estado: true },
    });
    if (!tenant) {
      throw new ForbiddenException('Tenant is not available');
    }
    const active = {
      authUserId,
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.nombre,
      status: tenant.estado,
      membershipId: resolved.membership_id,
      profileId: resolved.profile_id,
    };
    this.executionContext.set(active);
    return active;
  }

  async activatePlatformBilling(
    authUserId: string,
  ): Promise<PlatformBillingContext> {
    if (!this.prisma.hasRequestTransaction()) {
      throw new ForbiddenException('Request transaction is required');
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ profile_id: string; platform_admin_id: string }>
    >(
      Prisma.sql`SELECT * FROM app_private.set_platform_billing_context(
        ${authUserId}::uuid
      )`,
    );
    const resolved = rows[0];
    if (!resolved) {
      throw new ForbiddenException('Platform finance access is required');
    }
    return {
      profileId: resolved.profile_id,
      platformAdminId: resolved.platform_admin_id,
    };
  }

  private async activateWithResolver(
    authUserId: string,
    tenantSelector: string | undefined,
    mode: 'billing',
  ): Promise<ActiveTenantContext> {
    if (!this.prisma.hasRequestTransaction()) {
      throw new ForbiddenException('Tenant transaction is required');
    }
    let rows: ResolvedContextRow[];
    try {
      rows = await this.prisma.$queryRaw<ResolvedContextRow[]>(
        Prisma.sql`SELECT * FROM app_private.resolve_billing_request_context(
          ${authUserId}::uuid,
          ${tenantSelector ?? null}::text
        )`,
      );
    } catch {
      throw new ForbiddenException(`No ${mode} tenant membership was found`);
    }
    const resolved = rows[0];
    if (!resolved) {
      throw new ForbiddenException(`No ${mode} tenant membership was found`);
    }
    await this.prisma.$executeRaw(
      Prisma.sql`SELECT app_private.set_billing_request_context(
        ${authUserId}::uuid,
        ${resolved.tenant_id}::uuid,
        ${resolved.profile_id}::uuid,
        ${resolved.membership_id}::uuid
      )`,
    );
    const tenant = await this.prisma.tenants.findUnique({
      where: { id: resolved.tenant_id },
      select: { id: true, slug: true, nombre: true, estado: true },
    });
    if (!tenant) {
      throw new ForbiddenException('Tenant is not available');
    }
    const active = {
      authUserId,
      id: tenant.id,
      slug: tenant.slug,
      name: tenant.nombre,
      status: tenant.estado,
      membershipId: resolved.membership_id,
      profileId: resolved.profile_id,
    };
    this.executionContext.set(active);
    return active;
  }
}
