import { Router } from 'express';
import {
  listMyConversations,
  getConversationById,
  getConversationMessages,
  sendMessage,
  getOrCreateConversation,
} from './conversations.controller.js';
import { authenticateUser } from '../../middleware/auth.js';
import { validateRequest } from '../../middleware/validate.js';
import { sendMessageSchema } from './conversations.schema.js';

const conversationsRoutes = Router();

// List conversations where authenticated user is a participant
conversationsRoutes.get('/', authenticateUser(), listMyConversations);

// Initialize or retrieve existing conversation for a contract or recipient
conversationsRoutes.post('/', authenticateUser(), getOrCreateConversation);


// Get single conversation details (participant check enforced)
conversationsRoutes.get('/:id', authenticateUser(), getConversationById);

// Get paginated messages in conversation (participant check enforced)
conversationsRoutes.get('/:id/messages', authenticateUser(), getConversationMessages);

// Send a message in conversation (participant check enforced)
conversationsRoutes.post(
  '/:id/messages',
  authenticateUser(),
  validateRequest({ body: sendMessageSchema }),
  sendMessage,
);

export { conversationsRoutes };

