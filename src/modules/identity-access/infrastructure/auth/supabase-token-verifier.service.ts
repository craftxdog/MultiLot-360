import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EnvConfigService } from '../../../../config/env-config.service';
import { SupabaseJwtPayload } from '../../domain';

@Injectable()
export class SupabaseTokenVerifierService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly envConfig: EnvConfigService,
  ) {}

  async verify(token: string): Promise<SupabaseJwtPayload> {
    try {
      return await this.jwtService.verifyAsync<SupabaseJwtPayload>(token, {
        secret: this.envConfig.supabase.jwtSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
