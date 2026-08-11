import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { ActiveTenantContext } from './tenant-context.service';

type TenantExecutionStore = {
  tenant?: ActiveTenantContext;
  afterRollback: Array<() => Promise<void>>;
};

@Injectable()
export class TenantExecutionContextService {
  private readonly storage = new AsyncLocalStorage<TenantExecutionStore>();

  run<T>(work: () => Promise<T>): Promise<T> {
    return this.storage.run({ afterRollback: [] }, work);
  }

  set(tenant: ActiveTenantContext): void {
    const store = this.storage.getStore();
    if (!store) throw new Error('Tenant execution context is not active');
    store.tenant = tenant;
  }

  get(): ActiveTenantContext | undefined {
    return this.storage.getStore()?.tenant;
  }

  deferAfterRollback(work: () => Promise<void>): void {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('Tenant execution context is not active');
    }
    store.afterRollback.push(work);
  }

  takeAfterRollback(): Array<() => Promise<void>> {
    const store = this.storage.getStore();
    if (!store) return [];

    const tasks = [...store.afterRollback];
    store.afterRollback.length = 0;
    return tasks;
  }
}
