import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const key = request.header('Idempotency-Key');

    if (!key) {
      throw new BadRequestException({
        code: 'MISSING_IDEMPOTENCY_KEY',
        message: 'The Idempotency-Key header is required',
      });
    }

    const existingRecord = await this.prisma.idempotencyKey.findUnique({
      where: { key },
    });

    if (existingRecord) {
      let parsedBody: any;
      let statusCode = 200;

      try {
        parsedBody = JSON.parse(existingRecord.responseBody);
        // Soporta formatos guardados con metadata { statusCode, body } o payload directo
        if (
          parsedBody &&
          typeof parsedBody === 'object' &&
          'statusCode' in parsedBody &&
          'body' in parsedBody
        ) {
          statusCode = parsedBody.statusCode;
          parsedBody = parsedBody.body;
        }
      } catch {
        parsedBody = existingRecord.responseBody;
      }

      response.status(statusCode).json(parsedBody);
      return false;
    }

    (request as any).idempotencyKey = key;
    return true;
  }
}
