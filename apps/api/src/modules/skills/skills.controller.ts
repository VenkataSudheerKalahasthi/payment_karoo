import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { recordAuditLog } from '../../utils/audit.js';
import { logger } from '../../utils/logger.js';
import { CreateSkillInput } from './skills.schema.js';

export async function listSkills(req: Request, res: Response): Promise<void> {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    });
    sendSuccess(res, 200, skills);
  } catch (error) {
    logger.error('Error listing skills:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve skills list');
  }
}

export async function createSkill(req: Request, res: Response): Promise<void> {
  const admin = req.user!;
  const input = req.body as CreateSkillInput;

  try {
    const existing = await prisma.skill.findUnique({
      where: { name: input.name },
    });

    if (existing) {
      sendError(res, 409, 'SKILL_EXISTS', 'A skill with this name already exists');
      return;
    }

    const skill = await prisma.skill.create({
      data: {
        name: input.name,
        category: input.category || null,
      },
    });

    await recordAuditLog({
      actorId: admin.id,
      action: 'CREATE_SKILL',
      resource: 'Skill',
      resourceId: skill.id,
      details: { name: skill.name },
      req,
    });

    sendSuccess(res, 201, skill);
  } catch (error) {
    logger.error('Error creating skill:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to create skill');
  }
}

