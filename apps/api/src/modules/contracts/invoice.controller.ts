import { Request, Response } from 'express';
import { prisma } from '../../config/prisma.js';
import { sendSuccess, sendError } from '../../utils/response.js';
import { logger } from '../../utils/logger.js';
import { UserRole } from '@prisma/client';
import { InvoiceDto } from '@trustpay/shared';
import { streamInvoicePdf } from './invoice-pdf.service.js';

function buildContractInvoice(contract: any): InvoiceDto {
  const clientName = `${contract.client?.firstName || ''} ${contract.client?.lastName || ''}`.trim() || 'Client';
  const workerName = `${contract.worker?.firstName || ''} ${contract.worker?.lastName || ''}`.trim() || 'Specialist';
  const totalAmount = Number(contract.totalAmount || 0);

  return {
    id: `inv-${contract.id}`,
    invoiceNumber: `INV-${contract.contractNumber}-FULL`,
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    contractTitle: contract.title,
    issuedAt: contract.createdAt ? new Date(contract.createdAt).toISOString() : new Date().toISOString(),
    dueDate: contract.endDate ? new Date(contract.endDate).toISOString() : undefined,
    status: contract.status === 'COMPLETED' ? 'PAID' : contract.status === 'ACTIVE' ? 'IN_ESCROW' : 'PENDING',
    currency: contract.currency || 'USD',
    subtotal: totalAmount,
    taxOrFee: 0,
    total: totalAmount,
    client: {
      id: contract.clientId,
      name: clientName,
      email: contract.client?.email || '',
    },
    specialist: {
      id: contract.workerId,
      name: workerName,
      email: contract.worker?.email || '',
    },
    lineItems: (contract.milestones || []).map((m: any) => ({
      description: `Milestone ${m.order}: ${m.title}`,
      milestoneOrder: m.order,
      amount: Number(m.amount || 0),
      currency: contract.currency || 'USD',
      status: m.status,
    })),
  };
}

function buildMilestoneInvoice(contract: any, milestone: any): InvoiceDto {
  const clientName = `${contract.client?.firstName || ''} ${contract.client?.lastName || ''}`.trim() || 'Client';
  const workerName = `${contract.worker?.firstName || ''} ${contract.worker?.lastName || ''}`.trim() || 'Specialist';
  const amount = Number(milestone.amount || 0);

  let status: 'PAID' | 'IN_ESCROW' | 'PENDING' | 'REFUNDED' = 'PENDING';
  if (milestone.status === 'APPROVED' || milestone.status === 'COMPLETED') {
    status = 'PAID';
  } else if (milestone.status === 'SUBMITTED' || milestone.status === 'UNDER_REVIEW' || milestone.status === 'IN_PROGRESS') {
    status = 'IN_ESCROW';
  }

  return {
    id: `inv-${contract.id}-${milestone.id}`,
    invoiceNumber: `INV-${contract.contractNumber}-M${milestone.order}`,
    contractId: contract.id,
    contractNumber: contract.contractNumber,
    contractTitle: contract.title,
    milestoneId: milestone.id,
    milestoneOrder: milestone.order,
    issuedAt: milestone.createdAt ? new Date(milestone.createdAt).toISOString() : new Date().toISOString(),
    dueDate: milestone.dueDate ? new Date(milestone.dueDate).toISOString() : undefined,
    status,
    currency: contract.currency || 'USD',
    subtotal: amount,
    taxOrFee: 0,
    total: amount,
    client: {
      id: contract.clientId,
      name: clientName,
      email: contract.client?.email || '',
    },
    specialist: {
      id: contract.workerId,
      name: workerName,
      email: contract.worker?.email || '',
    },
    lineItems: [
      {
        description: `Milestone ${milestone.order}: ${milestone.title}`,
        milestoneOrder: milestone.order,
        amount,
        currency: contract.currency || 'USD',
        status: milestone.status,
      },
    ],
  };
}

/**
 * List all invoices across all user contracts (Client or Specialist).
 */
export async function listAllMyInvoices(req: Request, res: Response): Promise<void> {
  const user = req.user!;
  const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const contracts = await prisma.contract.findMany({
      where: isPrivileged
        ? {}
        : {
            OR: [{ clientId: user.id }, { workerId: user.id }],
          },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const invoices: InvoiceDto[] = [];
    for (const contract of contracts) {
      invoices.push(buildContractInvoice(contract));
      for (const milestone of contract.milestones) {
        invoices.push(buildMilestoneInvoice(contract, milestone));
      }
    }

    sendSuccess(res, 200, {
      items: invoices,
      total: invoices.length,
    });
  } catch (error) {
    logger.error('Error listing user invoices:', error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve invoices');
  }
}

/**
 * List invoices for a specific contract.
 */
export async function listContractInvoices(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const user = req.user!;
  const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (!isPrivileged && contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to contract invoices');
      return;
    }

    const invoices: InvoiceDto[] = [buildContractInvoice(contract)];
    for (const m of contract.milestones) {
      invoices.push(buildMilestoneInvoice(contract, m));
    }

    sendSuccess(res, 200, invoices);
  } catch (error) {
    logger.error(`Error listing invoices for contract ${id}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to retrieve contract invoices');
  }
}

/**
 * Download Invoice PDF.
 */
export async function downloadInvoicePdf(req: Request, res: Response): Promise<void> {
  const { id, invoiceId } = req.params;
  const user = req.user!;
  const isPrivileged = user.role.name === UserRole.ADMIN || user.role.name === UserRole.SUPERADMIN;

  try {
    const contract = await prisma.contract.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        milestones: {
          orderBy: { order: 'asc' },
        },
      },
    });

    if (!contract) {
      sendError(res, 404, 'NOT_FOUND', 'Contract not found');
      return;
    }

    if (!isPrivileged && contract.clientId !== user.id && contract.workerId !== user.id) {
      sendError(res, 403, 'FORBIDDEN', 'Access denied to invoice');
      return;
    }

    let invoiceData: InvoiceDto | null = null;
    if (invoiceId.includes('-M') || invoiceId.startsWith('inv-')) {
      // Find milestone
      const milestone = contract.milestones.find(
        (m) => invoiceId.endsWith(m.id) || invoiceId.endsWith(`-M${m.order}`),
      );
      if (milestone) {
        invoiceData = buildMilestoneInvoice(contract, milestone);
      }
    }

    if (!invoiceData) {
      invoiceData = buildContractInvoice(contract);
    }

    streamInvoicePdf(res, invoiceData);
  } catch (error) {
    logger.error(`Error streaming invoice PDF for contract ${id}:`, error);
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', 'Failed to generate invoice PDF');
  }
}

