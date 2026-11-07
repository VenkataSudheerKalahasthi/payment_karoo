import PDFDocument from 'pdfkit';
import { Response } from 'express';
import { InvoiceDto } from '@trustpay/shared';

/**
 * Generates an Invoice PDF document as an in-memory Buffer.
 */
export function generateInvoicePdfBuffer(data: InvoiceDto): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    buildInvoicePdf(doc, data);
  });
}

/**
 * Streams a professional Invoice PDF document to the HTTP response.
 */
export function streamInvoicePdf(res: Response, data: InvoiceDto): void {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="Invoice-${data.invoiceNumber}.pdf"`,
  );

  doc.pipe(res);
  buildInvoicePdf(doc, data);
}

function buildInvoicePdf(doc: InstanceType<typeof PDFDocument>, data: InvoiceDto): void {
  // 1. Header Banner
  doc.rect(0, 0, doc.page.width, 70).fill('#0B0D14');
  doc.font('Helvetica-Bold').fillColor('#1F61EF').fontSize(20).text('TRUSTPAY', 40, 20);
  doc.font('Helvetica').fillColor('#94a3b8').fontSize(9).text('ENTERPRISE DIGITAL ESCROW & INVOICING', 40, 44);
  doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(11).text(`INVOICE: ${data.invoiceNumber}`, 360, 22, { align: 'right' });
  doc.font('Helvetica').fillColor('#1F61EF').fontSize(9).text(`STATUS: ${data.status}`, 360, 40, { align: 'right' });

  doc.moveDown(3);

  // 2. Dates and Contract Reference
  const metaY = 85;
  doc.rect(40, metaY, doc.page.width - 80, 50).fillAndStroke('#f8fafc', '#e2e8f0');

  doc.font('Helvetica-Bold').fillColor('#475569').fontSize(8).text('DATE ISSUED', 55, metaY + 10);
  doc.font('Helvetica').fillColor('#0f172a').fontSize(9.5).text(new Date(data.issuedAt).toLocaleDateString(), 55, metaY + 24);

  doc.font('Helvetica-Bold').fillColor('#475569').fontSize(8).text('DUE DATE', 180, metaY + 10);
  doc.font('Helvetica').fillColor('#0f172a').fontSize(9.5).text(data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'Immediate upon release', 180, metaY + 24);

  doc.font('Helvetica-Bold').fillColor('#475569').fontSize(8).text('CONTRACT REFERENCE', 310, metaY + 10);
  doc.font('Helvetica').fillColor('#0f172a').fontSize(9.5).text(`${data.contractNumber} (${data.contractTitle.slice(0, 25)})`, 310, metaY + 24);

  // 3. Parties Box (Billed To vs Billed By)
  const partiesY = metaY + 62;
  doc.rect(40, partiesY, doc.page.width - 80, 75).fillAndStroke('#ffffff', '#e2e8f0');

  // Client Column (Billed To)
  doc.font('Helvetica-Bold').fillColor('#15803d').fontSize(9).text('BILLED TO (CLIENT)', 55, partiesY + 10);
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(10).text(data.client.name || 'Verified Client', 55, partiesY + 26);
  doc.font('Helvetica').fillColor('#64748b').fontSize(9).text(data.client.email, 55, partiesY + 42);

  // Specialist Column (Billed By)
  const specX = doc.page.width / 2 + 10;
  doc.font('Helvetica-Bold').fillColor('#15803d').fontSize(9).text('ISSUED BY (SPECIALIST)', specX, partiesY + 10);
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(10).text(data.specialist.name || 'Verified Specialist', specX, partiesY + 26);
  doc.font('Helvetica').fillColor('#64748b').fontSize(9).text(data.specialist.email, specX, partiesY + 42);

  // 4. Line Items Table
  let currentY = partiesY + 90;
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(11).text('ITEMIZED DELIVERABLES & ESCROW SCHEDULE', 40, currentY);
  currentY += 18;

  // Table Header
  doc.rect(40, currentY, doc.page.width - 80, 22).fill('#0f172a');
  doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(8.5).text('#', 50, currentY + 6);
  doc.text('Description / Deliverable', 80, currentY + 6);
  doc.text('Status', 360, currentY + 6);
  doc.text('Amount', 470, currentY + 6, { align: 'right' });

  currentY += 24;

  data.lineItems.forEach((item, index) => {
    if (currentY > 700) {
      doc.addPage();
      currentY = 40;
    }

    doc.rect(40, currentY, doc.page.width - 80, 24).fillAndStroke(index % 2 === 0 ? '#ffffff' : '#f8fafc', '#f1f5f9');
    doc.font('Helvetica').fillColor('#475569').fontSize(8.5).text(String(item.milestoneOrder ?? index + 1), 50, currentY + 7);
    doc.fillColor('#0f172a').text(item.description, 80, currentY + 7, { width: 270, ellipsis: true });
    doc.fillColor('#15803d').text(item.status, 360, currentY + 7);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(`${item.amount.toFixed(2)} ${item.currency}`, 470, currentY + 7, { align: 'right' });

    currentY += 26;
  });

  // 5. Totals Box
  currentY += 8;
  const totalsX = doc.page.width - 240;
  doc.rect(totalsX, currentY, 200, 65).fillAndStroke('#f8fafc', '#e2e8f0');

  doc.font('Helvetica').fillColor('#64748b').fontSize(9).text('Subtotal:', totalsX + 15, currentY + 10);
  doc.font('Helvetica').fillColor('#0f172a').fontSize(9).text(`${data.subtotal.toFixed(2)} ${data.currency}`, totalsX + 100, currentY + 10, { align: 'right' });

  doc.font('Helvetica').fillColor('#64748b').fontSize(9).text('Platform Fee:', totalsX + 15, currentY + 26);
  doc.font('Helvetica').fillColor('#0f172a').fontSize(9).text(`${data.taxOrFee.toFixed(2)} ${data.currency}`, totalsX + 100, currentY + 26, { align: 'right' });

  doc.rect(totalsX + 10, currentY + 42, 180, 1).fill('#cbd5e1');

  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(10.5).text('Total:', totalsX + 15, currentY + 47);
  doc.font('Helvetica-Bold').fillColor('#15803d').fontSize(10.5).text(`${data.total.toFixed(2)} ${data.currency}`, totalsX + 100, currentY + 47, { align: 'right' });

  currentY += 85;

  // 6. Escrow & Legal Notice
  if (currentY > 680) {
    doc.addPage();
    currentY = 40;
  }

  doc.rect(40, currentY, doc.page.width - 80, 55).fillAndStroke('#f1f5f9', '#e2e8f0');
  doc.font('Helvetica-Bold').fillColor('#0f172a').fontSize(8.5).text('NON-CUSTODIAL ESCROW PAYMENT GUARANTEE', 55, currentY + 8);
  doc.font('Helvetica').fillColor('#475569').fontSize(7.5).text(
    'This invoice reflects digital escrow funds locked under smart contract agreements on the TrustPay platform. Milestone funds remain in cryptographic escrow custody until explicit deliverable verification and release by the authorized Client.',
    55,
    currentY + 22,
    { width: doc.page.width - 110, lineGap: 1.5 },
  );

  doc.y = currentY + 70;
  doc.font('Helvetica-Oblique').fillColor('#94a3b8').fontSize(7).text(
    'Generated automatically by TrustPay Enterprise Invoicing Engine. Valid without physical signature.',
    40,
    doc.y,
    { align: 'center' },
  );

  doc.end();
}

