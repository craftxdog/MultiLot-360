import { Injectable } from '@nestjs/common';
import { createHmac, randomInt } from 'node:crypto';
import { EnvConfigService } from '../../../../config/env-config.service';

@Injectable()
export class SellerAccessCodeService {
  constructor(private readonly envConfig: EnvConfigService) {}

  generate(): string {
    return randomInt(100000, 1000000).toString();
  }

  hash(code: string): string {
    const secret = this.envConfig.sellerAccess.codeSecret;

    if (!secret) {
      throw new Error(
        'SELLER_ACCESS_CODE_SECRET or SUPABASE_JWT_SECRET is required',
      );
    }

    return createHmac('sha256', secret).update(code.trim()).digest('hex');
  }

  expiresAt(): Date {
    const expiresInMs =
      this.envConfig.sellerAccess.codeExpiresInMinutes * 60 * 1000;

    return new Date(Date.now() + expiresInMs);
  }
}
