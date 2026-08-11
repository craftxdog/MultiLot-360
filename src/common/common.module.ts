import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpExceptionFilter } from './filters';
import {
  RequestContextInterceptor,
  ResultInterceptor,
  TransformInterceptor,
} from './interceptors';
import { AccessLogMiddleware, TenantTransactionMiddleware } from './middleware';
import {
  TenantContextService,
  TenantExecutionContextService,
} from './services';

@Module({
  providers: [
    AccessLogMiddleware,
    TenantTransactionMiddleware,
    TenantContextService,
    TenantExecutionContextService,
    HttpExceptionFilter,
    RequestContextInterceptor,
    ResultInterceptor,
    TransformInterceptor,
  ],
  exports: [
    AccessLogMiddleware,
    TenantTransactionMiddleware,
    TenantContextService,
    TenantExecutionContextService,
    HttpExceptionFilter,
    RequestContextInterceptor,
    ResultInterceptor,
    TransformInterceptor,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenantTransactionMiddleware, AccessLogMiddleware)
      .forRoutes('{*path}');
  }
}
