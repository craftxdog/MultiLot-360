import { Inject, Injectable } from '@nestjs/common';
import {
  AppError,
  Result,
  UseCase,
  UseCaseError,
} from '../../../../shared-kernel';
import { ResolvedIdentity, SupabaseJwtPayload } from '../../domain/entities';
import {
  IDENTITY_ACCESS_REPOSITORY,
  IdentityAccessRepository,
} from '../../domain/ports';

@Injectable()
export class ResolveRequestIdentityUseCase extends UseCase<
  SupabaseJwtPayload,
  ResolvedIdentity,
  AppError
> {
  constructor(
    @Inject(IDENTITY_ACCESS_REPOSITORY)
    private readonly identityAccessRepository: IdentityAccessRepository,
  ) {
    super();
  }

  async execute(
    input: SupabaseJwtPayload,
  ): Promise<Result<ResolvedIdentity, AppError>> {
    if (!input.sub) {
      return Result.failure(
        new UseCaseError('Supabase subject claim is required', undefined, 401),
      );
    }

    const user = await this.identityAccessRepository.findByAuthUserId(
      input.sub,
    );

    if (!user) {
      return Result.failure(
        new UseCaseError(
          'Authenticated user is not registered',
          undefined,
          401,
        ),
      );
    }

    if (!user.active) {
      return Result.failure(
        new UseCaseError('Authenticated user is inactive', undefined, 403),
      );
    }

    return Result.success({
      claims: input,
      user,
    });
  }
}
