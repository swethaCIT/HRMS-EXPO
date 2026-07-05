import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // A NestJS HttpException's own response body is already the object
    // { statusCode, message, error } (message may be a string, or a string[]
    // from ValidationPipe). Unwrap that inner `message` instead of nesting the
    // whole object under our own `message` key below -- otherwise every
    // client's `err.response.data.message` is an object rather than the
    // string it expects, which crashes any UI that renders it directly.
    const body = exception instanceof HttpException ? exception.getResponse() : null;
    const message =
      typeof body === 'string'
        ? body
        : body && typeof body === 'object' && 'message' in (body as Record<string, unknown>)
          ? (body as Record<string, unknown>).message
          : exception instanceof HttpException
            ? exception.message
            : 'Internal server error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}
