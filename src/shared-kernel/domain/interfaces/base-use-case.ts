import { AppError } from '../exceptions';
import { Result } from '../result';

export abstract class UseCase<
  Input,
  Output,
  ErrorType extends AppError = AppError,
> {
  abstract execute(input: Input): Promise<Result<Output, ErrorType>>;
}
