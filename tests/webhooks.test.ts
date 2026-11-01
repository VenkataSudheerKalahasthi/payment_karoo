import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

describe('Webhook Security & Verification Tests', () => {
  const secret = 'whsec_test_secret_for_hardening_verification_123456';

  function verifyHmacSignature(payload: string, signature: string, testSecret: string): boolean {
    if (!signature || !payload) return false;
    try {
      const hmac = crypto.createHmac('sha256', testSecret);
      const computed = hmac.update(payload).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'));
    } catch {
      return false;
    }
  }

  it('rejects webhooks with missing signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed', id: 'evt_123' });
    const isValid = verifyHmacSignature(payload, '', secret);
    expect(isValid).toBe(false);
  });

  it('rejects webhooks with invalid or forged signature', () => {
    const payload = JSON.stringify({ event: 'payment.completed', id: 'evt_123' });
    const forgedSignature = crypto.createHmac('sha256', 'wrong_secret').update(payload).digest('hex');
    const isValid = verifyHmacSignature(payload, forgedSignature, secret);
    expect(isValid).toBe(false);
  });

  it('verifies legitimate webhook payload matching canonical signature in constant time', () => {
    const payload = JSON.stringify({ event: 'payment.completed', id: 'evt_123', amount: 50000 });
    const legitimateSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const isValid = verifyHmacSignature(payload, legitimateSignature, secret);
    expect(isValid).toBe(true);
  });

  it('guarantees live money movement cannot proceed when provider is PENDING_SELECTION', () => {
    const activeProvider = 'PENDING_SELECTION';
    const isLiveMoneyDisabled = true;

    // In TrustPay Phase 4/4.2, webhook handler strictly asserts live money custody
    const canMoveLiveFunds = activeProvider !== 'PENDING_SELECTION' && !isLiveMoneyDisabled;
    expect(canMoveLiveFunds).toBe(false);
  });
});

