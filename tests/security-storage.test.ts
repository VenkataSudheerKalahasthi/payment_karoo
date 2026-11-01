import { describe, it, expect } from 'vitest';
import { StorageService } from '../apps/api/src/modules/storage/storage.service.js';
import { BUCKET_LIMITS } from '../apps/api/src/modules/storage/storage.schema.js';
import { defaultPaymentProvider } from '../apps/api/src/modules/payments/pending.provider.js';
import { UserRole } from '@prisma/client';

describe('Storage & Financial Security Boundaries Tests', () => {
  const storageService = new StorageService();

  it('validates bucket file size and MIME constraints', () => {
    // Evidence bucket limit is 10MB
    expect(BUCKET_LIMITS.evidence.maxBytes).toBe(10485760);
    expect(BUCKET_LIMITS.evidence.allowedMimes).toContain('application/pdf');
    expect(BUCKET_LIMITS.evidence.allowedMimes).toContain('image/png');
    expect(BUCKET_LIMITS.evidence.allowedMimes).not.toContain('application/x-executable');

    // Invoices bucket limit is 5MB
    expect(BUCKET_LIMITS.invoices.maxBytes).toBe(5242880);
    expect(BUCKET_LIMITS.invoices.allowedMimes).toEqual(['application/pdf']);
  });

  it('rejects path traversal attacks in download object paths', async () => {
    const fakeUser = { id: 'user_1', role: { name: UserRole.CLIENT } };

    await expect(
      storageService.authorizeDownload('contract_1', '../../../etc/passwd', fakeUser),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_OBJECT_PATH',
    });

    await expect(
      storageService.authorizeDownload('contract_1', '/contracts/contract_1/evidence/file.pdf', fakeUser),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_OBJECT_PATH',
    });
  });

  it('rejects forged or expired download tokens', () => {
    expect(() => storageService.verifyDownloadToken('invalid-token')).toThrow();

    // Fabricate an expired token
    const expiredPayload = 'user_1:contracts/c1/evidence/doc.pdf:1000'; // Unix time 1000 is long expired
    const expiredToken = Buffer.from(JSON.stringify({ payload: expiredPayload, signature: 'bad_sig' })).toString('base64url');
    expect(() => storageService.verifyDownloadToken(expiredToken)).toThrow();
  });

  it('strictly rejects live payment attempts while provider selection is pending', async () => {
    expect(defaultPaymentProvider.name).toBe('PENDING_SELECTION');
    expect(defaultPaymentProvider.isAvailable()).toBe(false);

    await expect(
      defaultPaymentProvider.createPaymentIntent({
        amountMinor: 10000n,
        currency: 'USD',
        contractId: 'contract_1',
        payerId: 'client_1',
        idempotencyKey: 'idemp_key_1',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROVIDER_SELECTION_PENDING',
    });
  });
});

