import { z } from 'zod';

export const BUCKET_LIMITS = {
  evidence: {
    maxBytes: 10485760, // 10MB
    allowedMimes: ['application/pdf', 'image/png', 'image/jpeg', 'application/zip'],
  },
  'agreement-attachments': {
    maxBytes: 15728640, // 15MB
    allowedMimes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
  invoices: {
    maxBytes: 5242880, // 5MB
    allowedMimes: ['application/pdf'],
  },
} as const;

export const authorizeUploadSchema = z.object({
  bucket: z.enum(['evidence', 'agreement-attachments', 'invoices']),
  fileName: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^\\/:*?"<>|]+$/, 'Filename contains invalid or dangerous characters'),
  mimeType: z.string().trim().toLowerCase(),
  fileSizeBytes: z.number().int().positive(),
  contractId: z.string().uuid(),
  milestoneId: z.string().uuid().optional(),
});

export const authorizeDownloadSchema = z.object({
  objectPath: z.string().trim().min(1),
  contractId: z.string().uuid(),
});

export type AuthorizeUploadInput = z.infer<typeof authorizeUploadSchema>;
export type AuthorizeDownloadInput = z.infer<typeof authorizeDownloadSchema>;

