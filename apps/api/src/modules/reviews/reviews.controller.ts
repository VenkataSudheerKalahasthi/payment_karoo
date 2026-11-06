import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { createVerifiedReviewSchema } from './reviews.schema.js';

export async function submitVerifiedReview(req: Request, res: Response) {
  try {
    const input = createVerifiedReviewSchema.parse(req.body);
    const reviewerId = req.user!.id;

    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
      include: { project: true },
    });

    if (!contract) {
      return res.status(404).json({
        success: false,
        error: { code: 'CONTRACT_NOT_FOUND', message: 'Contract not found' },
      });
    }

    // Only allow reviews on genuinely COMPLETED contracts
    if (contract.status !== 'COMPLETED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'CONTRACT_NOT_COMPLETED',
          message: `Reviews are only permitted once a project contract is COMPLETED (current status: ${contract.status})`,
        },
      });
    }

    let revieweeId: string;
    if (contract.clientId === reviewerId) {
      revieweeId = contract.workerId;
    } else if (contract.workerId === reviewerId) {
      revieweeId = contract.clientId;
    } else {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You are not a counterparty to this contract' },
      });
    }

    if (reviewerId === revieweeId) {
      return res.status(400).json({
        success: false,
        error: { code: 'SELF_REVIEW_PROHIBITED', message: 'Self-reviews are strictly prohibited' },
      });
    }

    // Check duplicate review
    const existing = await prisma.verifiedReview.findUnique({
      where: { contractId_reviewerId: { contractId: contract.id, reviewerId } },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: { code: 'REVIEW_ALREADY_EXISTS', message: 'You have already submitted a review for this contract' },
      });
    }

    const overallRating =
      Number((input.workQuality + input.communication + input.timeliness + input.professionalism) / 4);

    const review = await prisma.$transaction(async (tx: any) => {
      const created = await tx.verifiedReview.create({
        data: {
          contractId: contract.id,
          projectId: contract.project?.id || null,
          reviewerId,
          revieweeId,
          workQuality: input.workQuality,
          communication: input.communication,
          timeliness: input.timeliness,
          professionalism: input.professionalism,
          overallRating,
          feedback: input.feedback,
          isVerified: true,
        },
        include: {
          reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        },
      });

      // If reviewee has a WorkerProfile, recalculate average rating and completed contracts
      const workerProfile = await tx.workerProfile.findUnique({ where: { userId: revieweeId } });
      if (workerProfile) {
        const reviews = await tx.verifiedReview.findMany({
          where: { revieweeId },
          select: { overallRating: true },
        });
        const total = reviews.reduce((sum: number, r: any) => sum + r.overallRating, 0);
        const avg = reviews.length > 0 ? Number((total / reviews.length).toFixed(2)) : 5.0;

        await tx.workerProfile.update({
          where: { userId: revieweeId },
          data: {
            rating: avg,
          },
        });
      }

      return created;
    });

    return res.status(201).json({
      success: true,
      data: review,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' },
      });
    }
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to submit review' },
    });
  }
}

export async function listUserReviews(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const reviews = await prisma.verifiedReview.findMany({
      where: { revieweeId: userId },
      include: {
        reviewer: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        contract: { select: { id: true, title: true, contractNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: reviews });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to list reviews' },
    });
  }
}
