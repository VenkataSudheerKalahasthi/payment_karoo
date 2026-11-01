import { z } from 'zod';

export const sendMessageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, 'Message content cannot be empty')
    .max(5000, 'Message cannot exceed 5000 characters'),
  attachmentUrls: z.array(z.string().url('Invalid attachment URL')).optional().default([]),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

