import { randomUUID } from 'node:crypto';
import pinoHttp from 'pino-http';
import type { Logger } from 'pino';

export function createRequestLogger(logger: Logger) {
  return pinoHttp({
    logger,
    genReqId: (_request, response) => {
      const requestId = randomUUID();
      response.setHeader('x-request-id', requestId);
      return requestId;
    },
    serializers: {
      req(request) {
        const path = request.url?.split('?')[0] ?? '/';
        return { id: request.id, method: request.method, path };
      },
      res(response) {
        return { statusCode: response.statusCode };
      },
    },
  });
}
