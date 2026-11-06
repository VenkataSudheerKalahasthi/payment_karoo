import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';

/**
 * Toggle Save Job (Specialist)
 */
export async function toggleSaveJob(req: Request, res: Response) {
  try {
    const { jobId } = req.params;
    const workerId = req.user!.id;

    const existing = await prisma.savedJob.findUnique({
      where: { workerId_jobPostId: { workerId, jobPostId: jobId } },
    });

    if (existing) {
      await prisma.savedJob.delete({
        where: { id: existing.id },
      });
      return res.json({ success: true, saved: false, message: 'Job removed from saved list' });
    } else {
      await prisma.savedJob.create({
        data: { workerId, jobPostId: jobId },
      });
      return res.json({ success: true, saved: true, message: 'Job saved successfully' });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to toggle saved job' },
    });
  }
}

/**
 * List Saved Jobs for current Specialist
 */
export async function listSavedJobs(req: Request, res: Response) {
  try {
    const saved = await prisma.savedJob.findMany({
      where: { workerId: req.user!.id },
      include: {
        jobPost: {
          include: {
            client: { select: { firstName: true, lastName: true, email: true } },
            skills: { include: { skill: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: saved });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to list saved jobs' },
    });
  }
}

/**
 * Toggle Save Specialist (Client)
 */
export async function toggleSaveSpecialist(req: Request, res: Response) {
  try {
    const { specialistId } = req.params;
    const clientId = req.user!.id;

    const existing = await prisma.savedSpecialist.findUnique({
      where: { clientId_specialistId: { clientId, specialistId } },
    });

    if (existing) {
      await prisma.savedSpecialist.delete({
        where: { id: existing.id },
      });
      return res.json({ success: true, saved: false, message: 'Specialist removed from saved list' });
    } else {
      await prisma.savedSpecialist.create({
        data: { clientId, specialistId, notes: req.body.notes || null },
      });
      return res.json({ success: true, saved: true, message: 'Specialist saved successfully' });
    }
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to toggle saved specialist' },
    });
  }
}

/**
 * List Saved Specialists for current Client
 */
export async function listSavedSpecialists(req: Request, res: Response) {
  try {
    const saved = await prisma.savedSpecialist.findMany({
      where: { clientId: req.user!.id },
      include: {
        specialist: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            workerProfile: {
              include: {
                skills: { include: { skill: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: saved });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'SERVER_ERROR', message: err.message || 'Failed to list saved specialists' },
    });
  }
}
