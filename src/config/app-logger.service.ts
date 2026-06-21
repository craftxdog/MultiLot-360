import { ConsoleLogger, Injectable, LogLevel } from '@nestjs/common';
import { EnvConfigService } from './env-config.service';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  constructor(private readonly envConfig: EnvConfigService) {
    super(envConfig.app.name, {
      timestamp: true,
      logLevels: AppLoggerService.resolveLogLevels(envConfig.app.logLevel),
    });
  }

  protected formatPid(_pid: number): string {
    void _pid;
    return '';
  }

  protected formatContext(context: string): string {
    return context ? `[${this.envConfig.app.name}:${context}] ` : '';
  }

  private static resolveLogLevels(level: string): LogLevel[] {
    const levels: LogLevel[] = ['error', 'warn', 'log', 'verbose', 'debug'];
    const index = levels.indexOf(level as LogLevel);

    return index === -1 ? ['error', 'warn', 'log'] : levels.slice(0, index + 1);
  }
}
