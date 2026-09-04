import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

function toSnakeUpper(name: string): string {
  return name
    .replace(/Exception$/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const exceptionName = exception.constructor?.name || 'HttpException';

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        const resMessage = (exceptionResponse as any).message;

        if (Array.isArray(resMessage)) {
          // Casos generados por ValidationPipe
          code = 'VALIDATION_ERROR';
          message = resMessage.join('; ');
        } else if (typeof resMessage === 'string') {
          code =
            (exceptionResponse as any).error
              ? toSnakeUpper((exceptionResponse as any).error)
              : toSnakeUpper(exceptionName);
          message = resMessage;
        } else {
          code = toSnakeUpper(exceptionName);
          message = exception.message;
        }

        // Si ya trae un code personalizado (ej: de excepciones de dominio específicas)
        if ((exceptionResponse as any).code) {
          code = (exceptionResponse as any).code;
        }
      } else if (typeof exceptionResponse === 'string') {
        code = toSnakeUpper(exceptionName);
        message = exceptionResponse;
      } else {
        code = toSnakeUpper(exceptionName);
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = exception.message || 'Internal server error';
    }

    response.status(status).json({
      error: {
        code,
        message,
      },
    });
  }
}
