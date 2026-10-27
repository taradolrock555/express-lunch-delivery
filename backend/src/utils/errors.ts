import type { Response } from 'express';

export class HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);

export const notFound = (message = 'ไม่พบข้อมูล') =>
  new HttpError(404, 'NOT_FOUND', message);

export const conflict = (message: string, details?: unknown) =>
  new HttpError(409, 'CONFLICT', message, details);

export function sendError(res: Response, error: unknown): void {
  if (error instanceof HttpError) {
    res.status(error.status).json({
      success: false,
      error: { code: error.code, message: error.message, details: error.details ?? null },
      message: error.message,
    });
    return;
  }

  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_JSON', message: 'รูปแบบ JSON ไม่ถูกต้อง', details: null },
      message: 'รูปแบบ JSON ไม่ถูกต้อง',
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', details: null },
    message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
  });
}
