import { z } from 'zod';

export const sendMessageSchema = z
  .object({
    content: z
      .string()
      .trim()
      .max(5000, 'Message cannot exceed 5000 characters')
      .default(''),
    attachmentUrls: z.array(z.string().min(1)).optional().default([]),
  })
  .refine((data) => data.content.length > 0 || (data.attachmentUrls && data.attachmentUrls.length > 0), {
    message: 'Message must contain either text or an attachment',
    path: ['content'],
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

