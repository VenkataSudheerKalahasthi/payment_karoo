import PDFDocument from 'pdfkit';
import crypto from 'crypto';
import { Response } from 'express';

export interface ContractPdfData {
  contractNumber: string;
  title: string;
  description: string;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  cancellationTerms?: string | null;
  revisionTerms?: string | null;
  version: number;
  totalAmount: number;
  currency: string;
  status: string;
  startDate?: Date | null;
  endDate?: Date | null;
  client: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  worker: {
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  milestones: {
    order: number;
    title: string;
    description: string;
    amount: number;
    status: string;
    dueDate?: Date | null;
  }[];
  acceptances: {
    role: string;
    acceptedAt: Date;
    acceptanceMethod: string;
    ipAddress?: string | null;
    documentHash?: string | null;
    user: {
      firstName?: string | null;
      lastName?: string | null;
      email: string;
    };
  }[];
  clientStamp?: {
    profileName: string;
    verifiedMobile: string;
    appliedAt: Date | string;
    stampPosition?: string;
    documentHash?: string | null;
  } | null;
}

export interface CanonicalContractHashInput {
  contractNumber: string;
  version: number;
  title: string;
  totalAmount: number | string;
  currency: string;
  clientId?: string;
  workerId?: string;
  scopeOfWork?: string | null;
  termsAndConditions?: string | null;
  cancellationTerms?: string | null;
  revisionTerms?: string | null;
  milestones?: Array<{
    order: number;
    title: string;
    description: string;
    amount: number | string;
  }>;
}

/**
 * Computes a deterministic canonical SHA-256 hash of the complete contract terms and milestone allocations.
 * Ensures deterministic serialization with sorted keys and normalized precision to prevent silent divergence.
 */
export function computeCanonicalContractHash(input: CanonicalContractHashInput): string {
  const sortedMilestones = (input.milestones || [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((m) => ({
      amount: Number(m.amount).toFixed(2),
      description: (m.description || '').trim(),
      order: m.order,
      title: (m.title || '').trim(),
    }));

  const canonicalPayload = {
    cancellationTerms: (input.cancellationTerms || '').trim(),
    clientId: input.clientId || '',
    contractNumber: input.contractNumber.trim(),
    currency: (input.currency || 'USD').trim().toUpperCase(),
    milestones: sortedMilestones,
    revisionTerms: (input.revisionTerms || '').trim(),
    scopeOfWork: (input.scopeOfWork || '').trim(),
    termsAndConditions: (input.termsAndConditions || '').trim(),
    title: input.title.trim(),
    totalAmount: Number(input.totalAmount).toFixed(2),
    version: input.version,
    workerId: input.workerId || '',
  };

  const canonicalJson = JSON.stringify(canonicalPayload);
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Backward-compatible wrapper for computeCanonicalContractHash.
 */
export function computeContractHash(contract: CanonicalContractHashInput): string {
  return computeCanonicalContractHash(contract);
}

/**
 * Generates a contract PDF document as an in-memory Buffer.
 */
export function generateContractPdfBuffer(data: ContractPdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    buildPdfDocument(doc, data);
  });
}

/**
 * Streams a professional Contract PDF document to the HTTP response.
 */
export function streamContractPdf(res: Response, data: ContractPdfData): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="Contract-${data.contractNumber}.pdf"`,
  );

  doc.pipe(res);
  buildPdfDocument(doc, data);
}

function buildPdfDocument(doc: InstanceType<typeof PDFDocument>, data: ContractPdfData): void {

  // 1. Header Banner
  doc.rect(0, 0, doc.page.width, 70).fill('#0f172a');
  doc.font('Helvetica-Bold').fillColor('#10b981').fontSize(18).text('TRUSTPAY ENTERPRISE', 40, 20);
  doc.font('Helvetica').fillColor('#94a3b8').fontSize(10).text('DIGITAL CONTRACT & ESCROW SPECIFICATION', 40, 42);
  doc.font('Helvetica-Bold').fillColor('#f8fafc').fontSize(10).text(`Contract #: ${data.contractNumber}`, 400, 25, { align: 'right' });
  doc.font('Helvetica').fillColor('#cbd5e1').fontSize(9).text(`Version ${data.version} | Status: ${data.status}`, 400, 40, { align: 'right' });

  doc.moveDown(3);

  // 2. Title & Overview
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(16).text(data.title, 40, 85);
  doc.moveDown(0.4);
  doc.font('Helvetica').fillColor('#475569').fontSize(10).text(data.description || 'No description provided.', { lineGap: 2 });
  doc.moveDown(1);

  // 3. Parties Box
  const partiesY = doc.y;
  doc.rect(40, partiesY, doc.page.width - 80, 80).fillAndStroke('#f8fafc', '#e2e8f0');

  // Client Column
  doc.font('Helvetica-Bold').fillColor('#047857').fontSize(10).text('CLIENT (BUYER)', 55, partiesY + 12);
  const clientName = `${data.client.firstName || ''} ${data.client.lastName || ''}`.trim() || 'Verified Client';
  doc.font('Helvetica').fillColor('#0f172a').fontSize(10).text(clientName, 55, partiesY + 28);
  doc.fillColor('#64748b').fontSize(9).text(data.client.email, 55, partiesY + 44);

  // Worker Column
  const workerX = doc.page.width / 2 + 10;
  doc.font('Helvetica-Bold').fillColor('#047857').fontSize(10).text('WORKER (SERVICE PROVIDER)', workerX, partiesY + 12);
  const workerName = `${data.worker.firstName || ''} ${data.worker.lastName || ''}`.trim() || 'Verified Worker';
  doc.font('Helvetica').fillColor('#0f172a').fontSize(10).text(workerName, workerX, partiesY + 28);
  doc.fillColor('#64748b').fontSize(9).text(data.worker.email, workerX, partiesY + 44);

  doc.y = partiesY + 95;

  // 4. Commercial Agreement Summary
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(11).text('COMMERCIAL TERMS', 40, doc.y);
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#334155').fontSize(9.5).text(`Total Agreed Value: ${data.totalAmount} ${data.currency} (Allocated across ${data.milestones.length} milestone${data.milestones.length > 1 ? 's' : ''})`);
  if (data.startDate || data.endDate) {
    const start = data.startDate ? new Date(data.startDate).toLocaleDateString() : 'Immediate';
    const end = data.endDate ? new Date(data.endDate).toLocaleDateString() : 'Open-ended';
    doc.text(`Timeline: ${start} to ${end}`);
  }
  doc.moveDown(0.8);

  // 5. Scope of Work
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(11).text('SCOPE OF WORK');
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#334155').fontSize(9).text(data.scopeOfWork || data.description, { lineGap: 1.5 });
  doc.moveDown(0.8);

  // 6. Milestones Table
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(11).text('MILESTONE DELIVERABLES & ALLOCATION');
  doc.moveDown(0.3);

  let currentY = doc.y;
  doc.rect(40, currentY, doc.page.width - 80, 20).fill('#e2e8f0');
  doc.font('Helvetica-Bold').fillColor('#1e293b').fontSize(8.5).text('#', 45, currentY + 5);
  doc.text('Milestone Deliverable', 70, currentY + 5);
  doc.text('Due Date', 340, currentY + 5);
  doc.text('Amount', 420, currentY + 5);
  doc.text('Status', 490, currentY + 5);

  currentY += 22;

  data.milestones.forEach((m) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    doc.rect(40, currentY, doc.page.width - 80, 22).fillAndStroke('#ffffff', '#f1f5f9');
    doc.font('Helvetica').fillColor('#475569').fontSize(8.5).text(String(m.order), 45, currentY + 6);
    doc.fillColor('#0f172a').text(m.title, 70, currentY + 6, { width: 260, ellipsis: true });
    doc.fillColor('#64748b').text(m.dueDate ? new Date(m.dueDate).toLocaleDateString() : 'N/A', 340, currentY + 6);
    doc.font('Helvetica-Bold').fillColor('#047857').text(`$${m.amount}`, 420, currentY + 6);
    doc.font('Helvetica').fillColor('#334155').text(m.status, 490, currentY + 6);

    currentY += 24;
  });

  doc.y = currentY + 10;

  // 7. Terms & Conditions
  if (doc.y > 660) {
    doc.addPage();
  }

  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(10).text('GENERAL & CANCELLATION TERMS');
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#64748b').fontSize(8).text(data.termsAndConditions || 'Standard TrustPay Digital Escrow terms apply. Funds remain locked in milestone custody until deliverable approval.', { lineGap: 1.5 });
  doc.moveDown(0.5);

  // 8. Digital Acceptance Audit Trail
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(10).text('DIGITAL ACCEPTANCE & INTEGRITY AUDIT TRAIL');
  doc.moveDown(0.3);

  if (data.acceptances && data.acceptances.length > 0) {
    data.acceptances.forEach((acc) => {
      const party = `${acc.role}: ${acc.user.firstName || ''} ${acc.user.lastName || ''} (${acc.user.email})`;
      const timestamp = new Date(acc.acceptedAt).toISOString();
      doc.font('Helvetica-Bold').fillColor('#047857').fontSize(8).text(`✓ ${party} — Method: ${acc.acceptanceMethod} at ${timestamp}`);
      if (acc.documentHash) {
        doc.font('Helvetica').fillColor('#94a3b8').fontSize(7.5).text(`  SHA-256 Document Hash: ${acc.documentHash} | Origin IP: ${acc.ipAddress || 'Internal'}`);
      }
      doc.moveDown(0.2);
    });
  } else {
    doc.font('Helvetica-Oblique').fillColor('#d97706').fontSize(8).text('Pending digital sign-off from required contract parties.');
  }

  // 9. Client Digital Office Stamp (Client only — Official TrustPay Seal)
  if (data.clientStamp) {
    if (doc.y > 640) {
      doc.addPage();
    }
    const stampY = doc.y + 10;
    renderClientOfficeStamp(doc, data.clientStamp, stampY);
    doc.y = stampY + 115;
  }

  doc.moveDown(1);
  doc.font('Helvetica-Oblique').fillColor('#64748b').fontSize(6.5).text(
    'LEGAL NOTICE: The cryptographic SHA-256 digest recorded herein represents a platform data-integrity and tamper-evidence checksum. It does not constitute a Qualified Electronic Signature (QES) or proof of statutory legal identity under EU eIDAS Regulation (910/2014) or US ESIGN Act.',
    { align: 'center' },
  );
  doc.moveDown(0.2);
  doc.font('Helvetica').fillColor('#94a3b8').fontSize(6).text(
    'Digitally tracked and recorded in the TrustPay Enterprise immutable audit log.',
    { align: 'center' },
  );

  doc.end();
}

/**
 * Formats a timestamp into official office stamp format (e.g. 05 NOV 2026).
 */
export function formatStampDate(dateInput: Date | string): string {
  const d = new Date(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Renders the official circular TrustPay Client Office Stamp.
 * Pure vector rendering in PDFKit guaranteeing ultra-sharp fidelity and zero pixelation.
 */
function renderClientOfficeStamp(
  doc: InstanceType<typeof PDFDocument>,
  stamp: NonNullable<ContractPdfData['clientStamp']>,
  startY: number,
): void {
  const position = stamp.stampPosition || 'BOTTOM_RIGHT';
  let cx = doc.page.width - 105;
  if (position === 'BOTTOM_LEFT') cx = 105;
  if (position === 'BOTTOM_CENTER') cx = doc.page.width / 2;

  const cy = startY + 54;
  const r = 50;

  doc.save();

  // 1. Concentric circular borders
  doc.circle(cx, cy, r).lineWidth(2).strokeColor('#047857').stroke();
  doc.circle(cx, cy, r - 3).lineWidth(0.6).strokeColor('#10b981').stroke();
  doc.circle(cx, cy, r - 6).lineWidth(1).strokeColor('#047857').stroke();

  // 2. Faint diagonal TRUSTPAY watermark
  doc.save();
  doc.translate(cx, cy);
  doc.rotate(-22);
  doc.font('Helvetica-Bold').fontSize(14).fillColor('#10b981').fillOpacity(0.12)
    .text('TRUSTPAY', -40, -5, { width: 80, align: 'center' });
  doc.restore();

  // 3. Header branding
  doc.fillOpacity(1);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#047857')
    .text('TRUSTPAY ENTERPRISE', cx - 44, cy - 35, { width: 88, align: 'center' });

  // 4. Subheader approval badge
  doc.font('Helvetica-Bold').fontSize(5.5).fillColor('#059669')
    .text('★ CLIENT APPROVED ★', cx - 44, cy - 25, { width: 88, align: 'center' });

  // 5. Dividing rule
  doc.moveTo(cx - 32, cy - 17).lineTo(cx + 32, cy - 17).lineWidth(0.5).strokeColor('#10b981').stroke();

  // 6. Client's Authenticated Profile Name (Pure Green Ink)
  const name = (stamp.profileName || 'Verified Client').toUpperCase();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#047857')
    .text(name, cx - 42, cy - 12, { width: 84, align: 'center', ellipsis: true });

  // 7. Verified mobile number (Pure Green Ink)
  doc.font('Helvetica').fontSize(6).fillColor('#059669')
    .text(`Mobile: ${stamp.verifiedMobile}`, cx - 42, cy + 1, { width: 84, align: 'center', ellipsis: true });

  // 8. Server-generated approval date
  const dateStr = formatStampDate(stamp.appliedAt);
  doc.font('Helvetica-Bold').fontSize(6.5).fillColor('#047857')
    .text(`Date: ${dateStr}`, cx - 42, cy + 12, { width: 84, align: 'center' });

  // 9. Bottom dividing rule & seal label
  doc.moveTo(cx - 32, cy + 23).lineTo(cx + 32, cy + 23).lineWidth(0.5).strokeColor('#10b981').stroke();
  doc.font('Helvetica-Bold').fontSize(5).fillColor('#059669')
    .text('OFFICIAL OFFICE SEAL', cx - 44, cy + 26, { width: 88, align: 'center' });

  doc.restore();
}
