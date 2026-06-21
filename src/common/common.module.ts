import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { HttpExceptionFilter } from './filters';
import {
  RequestContextInterceptor,
  ResultInterceptor,
  TransformInterceptor,
} from './interceptors';
import { AccessLogMiddleware } from './middleware';

@Module({
  providers: [
    AccessLogMiddleware,
    HttpExceptionFilter,
    RequestContextInterceptor,
    ResultInterceptor,
    TransformInterceptor,
  ],
  exports: [
    AccessLogMiddleware,
    HttpExceptionFilter,
    RequestContextInterceptor,
    ResultInterceptor,
    TransformInterceptor,
  ],
})
export class CommonModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessLogMiddleware).forRoutes('{*path}');
  }
}
