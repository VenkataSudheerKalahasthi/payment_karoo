import { Response } from 'express';
import { ApiResponse } from '@trustpay/shared';

export function sendSuccess<T>(res: Response, arg1: T | number, arg2?: T | number): Response {
  let statusCode: number;
  let data: T;

  if (typeof arg1 === 'number') {
    statusCode = arg1;
    data = arg2 as T;
  } else {
    data = arg1 as T;
    statusCode = typeof arg2 === 'number' ? arg2 : 200;
  }

  const payload: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}

export function sendError(
  res: Response,
  arg1: number | string,
  arg2: string,
  arg3?: string | number | unknown,
  arg4?: unknown,
): Response {
  let statusCode: number;
  let code: string;
  let message: string;
  let details: unknown;

  if (typeof arg1 === 'number') {
    statusCode = arg1;
    code = typeof arg2 === 'string' ? arg2 : 'ERROR';
    message = typeof arg3 === 'string' ? arg3 : '';
    details = arg4;
  } else {
    code = arg1;
    message = arg2;
    statusCode = typeof arg3 === 'number' ? arg3 : 400;
    details = arg4 !== undefined ? arg4 : typeof arg3 !== 'number' ? arg3 : undefined;
  }

  const payload: ApiResponse<null> = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(payload);
}
