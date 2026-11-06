import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { UserRole, NotificationType } from '@prisma/client';
import { SendMessageInput } from './conversations.schema.js';
import { getSocketServer } from '../realtime/socket.service.js';

/**
 * List all conversations where the authenticated user is an active participant.
 * Prevents unauthorized users from seeing conversations they do not belong to.
 */
export async function listMyConversations(req: Request, res: Response): Promise<void> {
  const user = req.user!;

  try {
    const isSuperadmin = user.role.name === UserRole.SUPERADMIN;

    const conversations = await prisma.conversation.findMany({
      where: isSuperadmin
        ? {}
        : {
            participants: {
              some: {
                userId: user.id,
              },
            },
          },
      orderBy: { updatedAt: 'desc' },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            status: true,
          },
        },
      },
    });

    sendSuccess(res, 200, conversations);
  } catch (error) {
    logger.error('Error listing conversations:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve conversations');
  }
}

/**
 * Get or create a conversation for a contract or with a participant.
 */
export async function getOrCreateConversation(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const { contractId, recipientId } = req.body as { contractId?: string; recipientId?: string };

  try {
    let targetRecipientId = recipientId;

    if (contractId) {
      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { id: true, clientId: true, workerId: true },
      });

      if (!contract) {
        sendError(res, 404, 'NOT_FOUND', 'Contract not found');
        return;
      }

      // Check if conversation already exists for this contract
      const existing = await prisma.conversation.findFirst({
        where: { contractId },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
          contract: {
            select: { id: true, contractNumber: true, title: true, status: true },
          },
        },
      });

      if (existing) {
        sendSuccess(res, 200, existing);
        return;
      }

      if (!targetRecipientId) {
        targetRecipientId = user.id === contract.clientId ? contract.workerId : contract.clientId;
      }
    }

    if (!targetRecipientId) {
      sendError(res, 400, 'BAD_REQUEST', 'Recipient ID or Contract ID is required');
      return;
    }

    // Check if a direct conversation already exists between these two users
    if (!contractId && targetRecipientId) {
      const existingDirect = await prisma.conversation.findFirst({
        where: {
          contractId: null,
          AND: [
            { participants: { some: { userId: user.id } } },
            { participants: { some: { userId: targetRecipientId } } },
          ],
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatarUrl: true,
                  role: { select: { name: true } },
                },
              },
            },
          },
          contract: {
            select: { id: true, contractNumber: true, title: true, status: true },
          },
        },
      });

      if (existingDirect) {
        sendSuccess(res, 200, existingDirect);
        return;
      }
    }

    // Create new conversation with both participants
    const newConversation = await prisma.conversation.create({
      data: {
        contractId: contractId || null,
        participants: {
          create: [
            { userId: user.id },
            { userId: targetRecipientId },
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        contract: {
          select: { id: true, contractNumber: true, title: true, status: true },
        },
      },
    });

    sendSuccess(res, 201, newConversation);
  } catch (error) {
    logger.error('Error creating/retrieving conversation:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to initialize conversation');
  }
}


/**
 * Get conversation details by ID.
 * Enforces participant authorization: only participants (or SUPERADMIN) can access.
 */
export async function getConversationById(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatarUrl: true,
                role: { select: { name: true } },
              },
            },
          },
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            title: true,
            status: true,
          },
        },
      },
    });

    if (!conversation) {
      sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
      return;
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    const isSuperadmin = user.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isSuperadmin) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied: you are not a participant in this conversation');
      return;
    }

    sendSuccess(res, 200, conversation);
  } catch (error) {
    logger.error('Error fetching conversation:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve conversation');
  }
}

/**
 * Get messages inside a conversation.
 * Enforces strict participant check to eliminate conversation eavesdropping.
 */
export async function getConversationMessages(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 100);
  const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
  const skip = (page - 1) * limit;

  try {
    // 1. Verify existence and authorization
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
      return;
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    const isSuperadmin = user.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isSuperadmin) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied: you are not authorized to view messages in this conversation');
      return;
    }

    // 2. Fetch paginated messages
    const [total, messages] = await Promise.all([
      prisma.message.count({ where: { conversationId: id } }),
      prisma.message.findMany({
        where: { conversationId: id },
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
              role: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    sendSuccess(res, 200, {
      items: messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    logger.error('Error fetching conversation messages:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve conversation messages');
  }
}

/**
 * Send a message inside a conversation.
 * Enforces that only authorized participants can post messages.
 */
export async function sendMessage(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const input = req.body as SendMessageInput;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      sendError(res, 404, 'NOT_FOUND', 'Conversation not found');
      return;
    }

    const isParticipant = conversation.participants.some((p) => p.userId === user.id);
    const isSuperadmin = user.role.name === UserRole.SUPERADMIN;

    if (!isParticipant && !isSuperadmin) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied: you cannot send messages in a conversation you are not part of');
      return;
    }

    // Create message and touch conversation updatedAt in transaction
    const message = await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId: id,
          senderId: user.id,
          content: input.content,
          attachments: input.attachmentUrls || [],
        },
        include: {
          sender: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
        },
      });

      await tx.conversation.update({
        where: { id },
        data: { updatedAt: new Date() },
      });

      // Notify the other participant(s)
      const otherParticipants = conversation.participants.filter((p) => p.userId !== user.id);
      for (const participant of otherParticipants) {
        await tx.notification.create({
          data: {
            recipientId: participant.userId,
            title: 'New Message',
            message: `${user.firstName || user.email}: ${input.content.slice(0, 80)}${input.content.length > 80 ? '...' : ''}`,
            type: NotificationType.MESSAGE_RECEIVED,
            metadata: { conversationId: id, messageId: createdMessage.id },
          },
        });
      }

      return createdMessage;
    });

    // Real-time Socket.IO Broadcast to active conversation room & user notification channels
    const socketServer = getSocketServer();
    if (socketServer) {
      socketServer.to(`conversation:${id}`).emit('message:new', message);
      const otherParticipants = conversation.participants.filter((p) => p.userId !== user.id);
      for (const participant of otherParticipants) {
        socketServer.to(`user:${participant.userId}`).emit('message:received', {
          conversationId: id,
          message,
        });
      }
    }

    sendSuccess(res, 201, message);
  } catch (error) {
    logger.error('Error sending message:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to send message');
  }
}
