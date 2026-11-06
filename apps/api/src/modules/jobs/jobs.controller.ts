import { Request, Response } from 'express';
import { jobsService } from './jobs.service.js';
import { createJobPostSchema, updateJobPostSchema, listJobsFilterSchema } from './jobs.schema.js';

export async function createJob(req: Request, res: Response) {
  try {
    const input = createJobPostSchema.parse(req.body);
    const job = await jobsService.createJobPost(req.user!.id, input as any);
    return res.status(201).json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to create job post' },
    });
  }
}

export async function updateJob(req: Request, res: Response) {
  try {
    const input = updateJobPostSchema.parse(req.body);
    const job = await jobsService.updateJobPost(req.params.id, req.user!.id, input as any);
    return res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: err.errors[0]?.message || 'Validation failed' },
      });
    }
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to update job post' },
    });
  }
}

export async function getJobById(req: Request, res: Response) {
  try {
    const job = await jobsService.getJobPostById(req.params.id, req.user?.id);
    return res.json({
      success: true,
      data: job,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: { code: err.code || 'SERVER_ERROR', message: err.message || 'Failed to retrieve job' },
    });
  }
}

export async function listJobs(req: Request, res: Response) {
  try {
    const filter = listJobsFilterSchema.parse(req.query);
    const result = await jobsService.listJobs({
      ...filter,
      workerId: req.user?.id,
    });
    return res.json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: err.message || 'Failed to list jobs' },
    });
  }
}

export async function listClientJobs(req: Request, res: Response) {
  try {
    const filter = listJobsFilterSchema.parse(req.query);
    const result = await jobsService.listJobs({
      ...filter,
      clientId: req.user!.id,
    });
    return res.json({
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: err.message || 'Failed to list client jobs' },
    });
  }
}

export async function deleteJobPost(req: Request, res: Response) {
  try {
    const { id } = req.params;
    await jobsService.deleteJobPost(id, req.user!.id);
    return res.json({
      success: true,
      data: { message: 'Job post deleted successfully' },
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    const status = err.message === 'UNAUTHORIZED' ? 403 : err.message === 'JOB_NOT_FOUND' ? 404 : 400;
    return res.status(status).json({
      success: false,
      error: { code: err.message || 'BAD_REQUEST', message: err.message || 'Failed to delete job' },
    });
  }
}
