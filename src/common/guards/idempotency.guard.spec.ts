import { BadRequestException, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';
import { IdempotencyGuard } from './idempotency.guard';
import { IdempotencyInterceptor } from '../interceptors/idempotency.interceptor';
import { PrismaService } from '../../prisma/prisma.service';

describe('Idempotency Mechanism', () => {
  let guard: IdempotencyGuard;
  let interceptor: IdempotencyInterceptor;
  let prismaService: {
    idempotencyKey: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };

  let mockRequest: any;
  let mockResponse: any;
  let mockContext: ExecutionContext;

  beforeEach(() => {
    prismaService = {
      idempotencyKey: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
    };

    guard = new IdempotencyGuard(prismaService as unknown as PrismaService);
    interceptor = new IdempotencyInterceptor(prismaService as unknown as PrismaService);

    mockRequest = {
      headers: {},
      header: (name: string) => mockRequest.headers[name.toLowerCase()] || mockRequest.headers[name],
    };

    mockResponse = {
      statusCode: 201,
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  describe('IdempotencyGuard', () => {
    it('caso 1: lanza BadRequestException si falta el header Idempotency-Key', async () => {
      mockRequest.headers = {};

      await expect(guard.canActivate(mockContext)).rejects.toThrow(BadRequestException);

      try {
        await guard.canActivate(mockContext);
      } catch (err: any) {
        expect(err.getResponse()).toEqual({
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'The Idempotency-Key header is required',
        });
      }
    });

    it('caso 2: si la key ya existe en BD, retorna false y envía la respuesta cacheada', async () => {
      mockRequest.headers['idempotency-key'] = 'existing-uuid-123';

      const cachedData = { id: 1, name: 'Alice' };
      prismaService.idempotencyKey.findUnique.mockResolvedValue({
        key: 'existing-uuid-123',
        responseBody: JSON.stringify({ statusCode: 201, body: cachedData }),
        createdAt: new Date(),
      });

      const canActivate = await guard.canActivate(mockContext);

      expect(canActivate).toBe(false);
      expect(prismaService.idempotencyKey.findUnique).toHaveBeenCalledWith({
        where: { key: 'existing-uuid-123' },
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith(cachedData);
    });

    it('caso 3: si la key es nueva, la adjunta al request y retorna true', async () => {
      mockRequest.headers['idempotency-key'] = 'new-uuid-456';

      prismaService.idempotencyKey.findUnique.mockResolvedValue(null);

      const canActivate = await guard.canActivate(mockContext);

      expect(canActivate).toBe(true);
      expect(mockRequest.idempotencyKey).toBe('new-uuid-456');
    });
  });

  describe('IdempotencyInterceptor', () => {
    it('guarda el response body en la tabla IdempotencyKey al completarse la petición', (done) => {
      mockRequest.idempotencyKey = 'new-uuid-456';
      mockResponse.statusCode = 201;

      const responseData = { id: 2, name: 'Bob' };
      const callHandler = {
        handle: () => of(responseData),
      };

      prismaService.idempotencyKey.upsert.mockResolvedValue({});

      interceptor.intercept(mockContext, callHandler).subscribe({
        next: (result) => {
          expect(result).toEqual(responseData);
        },
        complete: () => {
          expect(prismaService.idempotencyKey.upsert).toHaveBeenCalledWith({
            where: { key: 'new-uuid-456' },
            update: {
              responseBody: JSON.stringify({
                statusCode: 201,
                body: responseData,
              }),
            },
            create: {
              key: 'new-uuid-456',
              responseBody: JSON.stringify({
                statusCode: 201,
                body: responseData,
              }),
            },
          });
          done();
        },
      });
    });
  });
});
