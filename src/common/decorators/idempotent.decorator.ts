import { applyDecorators, UseFilters, UseGuards, UseInterceptors } from '@nestjs/common';
import { IdempotencyGuard } from '../guards/idempotency.guard';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';

export function Idempotent() {
  return applyDecorators(
    UseGuards(IdempotencyGuard),
    UseInterceptors(IdempotencyInterceptor),
  );
}
