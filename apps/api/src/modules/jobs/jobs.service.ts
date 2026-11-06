import { prisma } from '../../config/prisma.js';
import { CreateJobPostRequest, UpdateJobPostRequest } from '@trustpay/shared';

export class JobsService {
  /**
   * Create a new job post
   */
  async createJobPost(clientId: string, data: CreateJobPostRequest) {
    const { skills, minBudget, maxBudget, startDate, completionDate, applicationDeadline, ...rest } = data;

    return prisma.$transaction(async (tx: any) => {
      const job = await tx.jobPost.create({
        data: {
          ...rest,
          clientId,
          minBudget: minBudget !== undefined ? minBudget : null,
          maxBudget: maxBudget !== undefined ? maxBudget : null,
          startDate: startDate ? new Date(startDate) : null,
          completionDate: completionDate ? new Date(completionDate) : null,
          applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : null,
        },
      });

      if (skills && skills.length > 0) {
        for (const s of skills) {
          let targetSkillId = s.skillId;
          if (!targetSkillId && s.name) {
            const trimmed = s.name.trim();
            const existing = await tx.skill.findFirst({
              where: { name: { equals: trimmed, mode: 'insensitive' } },
            });
            if (existing) {
              targetSkillId = existing.id;
            } else {
              const created = await tx.skill.create({
                data: { name: trimmed, category: data.category || 'General' },
              });
              targetSkillId = created.id;
            }
          }

          await tx.jobPostSkill.create({
            data: {
              jobPostId: job.id,
              skillId: targetSkillId || null,
              customSkillName: s.name?.trim() || null,
              isPrimary: s.isPrimary ?? false,
            },
          });
        }
      }

      return tx.jobPost.findUnique({
        where: { id: job.id },
        include: {
          skills: { include: { skill: true } },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              profile: { select: { companyName: true, country: true } },
            },
          },
          _count: { select: { proposals: true } },
        },
      });
    });
  }

  /**
   * Delete / Remove a job post created by a client
   */
  async deleteJobPost(jobId: string, clientId: string) {
    const job = await prisma.jobPost.findUnique({
      where: { id: jobId },
      select: { id: true, clientId: true },
    });

    if (!job) {
      throw new Error('JOB_NOT_FOUND');
    }

    if (job.clientId !== clientId) {
      throw new Error('UNAUTHORIZED');
    }

    return prisma.$transaction(async (tx: any) => {
      await tx.jobPostSkill.deleteMany({ where: { jobPostId: jobId } });
      await tx.savedJob.deleteMany({ where: { jobPostId: jobId } });
      await tx.jobProposal.deleteMany({ where: { jobPostId: jobId } });
      return tx.jobPost.delete({ where: { id: jobId } });
    });
  }

  /**
   * Update an existing job post
   */
  async updateJobPost(jobId: string, clientId: string, data: UpdateJobPostRequest) {
    const existing = await prisma.jobPost.findUnique({ where: { id: jobId } });
    if (!existing) {
      throw { statusCode: 404, code: 'JOB_NOT_FOUND', message: 'Job post not found' };
    }
    if (existing.clientId !== clientId) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Only the job owner can update this job' };
    }

    const { skills, minBudget, maxBudget, startDate, completionDate, applicationDeadline, ...rest } = data;

    return prisma.$transaction(async (tx: any) => {
      await tx.jobPost.update({
        where: { id: jobId },
        data: {
          ...rest,
          minBudget: minBudget !== undefined ? minBudget : existing.minBudget,
          maxBudget: maxBudget !== undefined ? maxBudget : existing.maxBudget,
          startDate: startDate ? new Date(startDate) : existing.startDate,
          completionDate: completionDate ? new Date(completionDate) : existing.completionDate,
          applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : existing.applicationDeadline,
        },
      });

      if (skills !== undefined) {
        await tx.jobPostSkill.deleteMany({ where: { jobPostId: jobId } });
        for (const s of skills) {
          let targetSkillId = s.skillId;
          if (!targetSkillId && s.name) {
            const trimmed = s.name.trim();
            const existingSkill = await tx.skill.findFirst({
              where: { name: { equals: trimmed, mode: 'insensitive' } },
            });
            if (existingSkill) {
              targetSkillId = existingSkill.id;
            } else {
              const created = await tx.skill.create({
                data: { name: trimmed, category: existing.category },
              });
              targetSkillId = created.id;
            }
          }

          await tx.jobPostSkill.create({
            data: {
              jobPostId: jobId,
              skillId: targetSkillId || null,
              customSkillName: s.name?.trim() || null,
              isPrimary: s.isPrimary ?? false,
            },
          });
        }
      }

      return tx.jobPost.findUnique({
        where: { id: jobId },
        include: {
          skills: { include: { skill: true } },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              profile: { select: { companyName: true, country: true } },
            },
          },
          _count: { select: { proposals: true } },
        },
      });
    });
  }

  /**
   * Get single job post by ID with proposal counts & smart match breakdown if workerId provided
   */
  async getJobPostById(jobId: string, currentUserId?: string) {
    const job = await prisma.jobPost.findUnique({
      where: { id: jobId },
      include: {
        skills: { include: { skill: true } },
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
            profile: { select: { companyName: true, country: true } },
          },
        },
        _count: {
          select: {
            proposals: true,
          },
        },
      },
    });

    if (!job) {
      throw { statusCode: 404, code: 'JOB_NOT_FOUND', message: 'Job post not found' };
    }

    // Check application deadline auto-expiry
    if (job.applicationDeadline && new Date() > job.applicationDeadline && job.status === 'PUBLISHED') {
      await prisma.jobPost.update({
        where: { id: jobId },
        data: { status: 'EXPIRED' },
      });
      job.status = 'EXPIRED';
    }

    let isSaved = false;
    let matchScore: number | undefined;
    let matchFactors: string[] | undefined;

    if (currentUserId) {
      const saved = await prisma.savedJob.findUnique({
        where: { workerId_jobPostId: { workerId: currentUserId, jobPostId: jobId } },
      });
      isSaved = !!saved;

      const worker = await prisma.user.findUnique({
        where: { id: currentUserId },
        include: {
          workerProfile: {
            include: {
              skills: { include: { skill: true } },
            },
          },
        },
      });

      if (worker?.workerProfile) {
        const match = this.calculateMatchScore(job, worker.workerProfile);
        matchScore = match.score;
        matchFactors = match.explanations;
      }
    }

    return {
      ...job,
      isSaved,
      matchScore,
      matchFactors,
    };
  }

  /**
   * List jobs with multi-tier location search, pagination, and status filters
   */
  async listJobs(params: {
    search?: string;
    category?: string;
    workMode?: string;
    country?: string;
    state?: string;
    district?: string;
    city?: string;
    skill?: string;
    hiringType?: string;
    minBudget?: number;
    maxBudget?: number;
    status?: string;
    clientId?: string;
    workerId?: string;
    page: number;
    limit: number;
  }) {
    const {
      search,
      category,
      workMode,
      country,
      state,
      district,
      city,
      skill,
      hiringType,
      minBudget,
      maxBudget,
      status,
      clientId,
      workerId,
      page,
      limit,
    } = params;

    const where: any = {};

    if (clientId) {
      where.clientId = clientId;
      if (status) where.status = status;
    } else {
      where.status = status || 'PUBLISHED';
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (workMode) {
      where.workMode = workMode;
    }

    if (hiringType) {
      where.hiringType = hiringType;
    }

    // Hierarchical location filtering: Country -> State -> District -> City
    if (country) {
      where.country = { equals: country, mode: 'insensitive' };
    }
    if (state) {
      where.state = { equals: state, mode: 'insensitive' };
    }
    if (district) {
      where.district = { equals: district, mode: 'insensitive' };
    }
    if (city) {
      where.city = { equals: city, mode: 'insensitive' };
    }

    if (minBudget !== undefined) {
      where.maxBudget = { gte: minBudget };
    }
    if (maxBudget !== undefined) {
      where.minBudget = { lte: maxBudget };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (skill) {
      where.skills = {
        some: {
          OR: [
            { customSkillName: { contains: skill, mode: 'insensitive' } },
            { skill: { name: { contains: skill, mode: 'insensitive' } } },
          ],
        },
      };
    }

    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.jobPost.count({ where }),
      prisma.jobPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          skills: { include: { skill: true } },
          client: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatarUrl: true,
              profile: { select: { companyName: true, country: true } },
            },
          },
          _count: { select: { proposals: true } },
        },
      }),
    ]);

    // If workerId is provided, enrich with isSaved and match scores
    let workerProfile: any = null;
    let savedJobIds = new Set<string>();

    if (workerId) {
      const [worker, saved] = await Promise.all([
        prisma.user.findUnique({
          where: { id: workerId },
          include: { workerProfile: { include: { skills: { include: { skill: true } } } } },
        }),
        prisma.savedJob.findMany({
          where: { workerId },
          select: { jobPostId: true },
        }),
      ]);
      workerProfile = worker?.workerProfile;
      savedJobIds = new Set(saved.map((s: any) => s.jobPostId));
    }

    const enrichedItems = items.map((job: any) => {
      let matchScore: number | undefined;
      let matchFactors: string[] | undefined;

      if (workerProfile) {
        const match = this.calculateMatchScore(job, workerProfile);
        matchScore = match.score;
        matchFactors = match.explanations;
      }

      return {
        ...job,
        isSaved: savedJobIds.has(job.id),
        matchScore,
        matchFactors,
      };
    });

    return {
      items: enrichedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Explainable Smart Match Engine
   */
  calculateMatchScore(job: any, workerProfile: any) {
    let score = 0;
    const explanations: string[] = [];
    const breakdown = {
      skillsMatch: 0,
      locationMatch: 0,
      workModeMatch: 0,
      budgetMatch: 0,
      experienceMatch: 0,
    };

    // 1. Skill Matching (Up to 40 points)
    const jobSkills = (job.skills || []).map(
      (s: any) => (s.skill?.name || s.customSkillName || '').toLowerCase().trim()
    ).filter(Boolean);

    const workerSkills = (workerProfile.skills || []).map(
      (ws: any) => (ws.skill?.name || '').toLowerCase().trim()
    ).filter(Boolean);

    if (jobSkills.length > 0 && workerSkills.length > 0) {
      const matched = jobSkills.filter((js: string) => workerSkills.includes(js));
      const matchRatio = matched.length / jobSkills.length;
      breakdown.skillsMatch = Math.round(matchRatio * 40);
      score += breakdown.skillsMatch;
      if (matched.length > 0) {
        explanations.push(`Matched ${matched.length}/${jobSkills.length} required skills: ${matched.slice(0, 3).join(', ')}`);
      }
    } else if (jobSkills.length === 0) {
      breakdown.skillsMatch = 20; // baseline if no specific skills restricted
      score += 20;
    }

    // 2. Location & Work Mode Matching (Up to 25 points)
    if (job.workMode === 'REMOTE') {
      breakdown.workModeMatch = 15;
      breakdown.locationMatch = 10;
      score += 25;
      explanations.push('Fully Remote work opportunity matches any location');
    } else {
      if (job.city && workerProfile.city && job.city.toLowerCase() === workerProfile.city.toLowerCase()) {
        breakdown.locationMatch = 15;
        score += 15;
        explanations.push(`Exact city match (${job.city})`);
      } else if (job.state && workerProfile.state && job.state.toLowerCase() === workerProfile.state.toLowerCase()) {
        breakdown.locationMatch = 10;
        score += 10;
        explanations.push(`State match (${job.state})`);
      }

      if (job.workMode === workerProfile.workMode) {
        breakdown.workModeMatch = 10;
        score += 10;
        explanations.push(`Preferred work mode aligns (${job.workMode})`);
      }
    }

    // 3. Budget Compatibility (Up to 20 points)
    const hourly = Number(workerProfile.hourlyRate) || 0;
    if (hourly > 0 && job.minBudget && job.maxBudget) {
      const min = Number(job.minBudget);
      const max = Number(job.maxBudget);
      if (hourly >= min * 0.8 && hourly <= max * 1.2) {
        breakdown.budgetMatch = 20;
        score += 20;
        explanations.push('Specialist rate fits within estimated budget window');
      } else {
        breakdown.budgetMatch = 10;
        score += 10;
      }
    } else {
      breakdown.budgetMatch = 15;
      score += 15;
    }

    // 4. Completed Experience / Track Record (Up to 15 points)
    const completed = workerProfile.totalCompletedContracts || 0;
    const rating = Number(workerProfile.rating) || 0;
    if (completed >= 5 && rating >= 4.5) {
      breakdown.experienceMatch = 15;
      score += 15;
      explanations.push(`Proven track record: ${completed} completed contracts with ${rating.toFixed(1)}/5.0 rating`);
    } else if (completed >= 1) {
      breakdown.experienceMatch = 10;
      score += 10;
      explanations.push(`Verified previous deliveries (${completed} contracts)`);
    } else {
      breakdown.experienceMatch = 5;
      score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    return {
      score,
      breakdown,
      explanations,
    };
  }
}

export const jobsService = new JobsService();
