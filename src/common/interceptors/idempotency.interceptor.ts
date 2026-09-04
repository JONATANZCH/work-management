import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const key = (request as any).idempotencyKey;

    return next.handle().pipe(
      tap(async (data) => {
        if (key) {
          try {
            const statusCode = response.statusCode || 200;
            const payloadToSave = JSON.stringify({
              statusCode,
              body: data,
            });

            await this.prisma.idempotencyKey.upsert({
              where: { key },
              update: { responseBody: payloadToSave },
              create: {
                key,
                responseBody: payloadToSave,
              },
            });
          } catch (err) {
            // No bloquear la respuesta si el cacheo de idempotencia falla
            console.error('Failed to persist IdempotencyKey:', err);
          }
        }
      }),
    );
  }
}
