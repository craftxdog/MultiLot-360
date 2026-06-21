import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  AUTH_PROVIDER,
  AuthProviderPort,
  SupabaseJwtPayload,
} from '../../domain';

@Injectable()
export class SupabaseTokenVerifierService {
  constructor(
    @Inject(AUTH_PROVIDER)
    private readonly authProvider: AuthProviderPort,
  ) {}

  async verify(token: string): Promise<SupabaseJwtPayload> {
    try {
      return await this.authProvider.verifyAccessToken(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
