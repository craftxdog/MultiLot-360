import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from './configuration';

type ConfigKey = keyof AppConfig;

@Injectable()
export class EnvConfigService {
  constructor(private readonly configService: ConfigService) {}

  get<T extends ConfigKey>(key: T): AppConfig[T] {
    const value = this.configService.get<AppConfig[T]>(key);

    if (value === undefined || value === null) {
      throw new Error(`Config key "${key}" is not defined`);
    }
    return value;
  }
  get app() {
    return this.get('app');
  }
  get swagger() {
    return this.get('swagger');
  }
  get supabase() {
    return this.get('supabase');
  }
  get database() {
    return this.get('database');
  }
  get redis() {
    return this.get('redis');
  }
  get realtime() {
    return this.get('realtime');
  }
  get mailer() {
    return this.get('mailer');
  }
  get sellerAccess() {
    return this.get('sellerAccess');
  }
  get auth() {
    return this.get('auth');
  }
}
