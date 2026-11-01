import { IPaymentProvider, PaymentIntentInput, PaymentIntentResult } from './provider.interface.js';

/**
 * Default Provider representing the pending provider selection state.
 * Strictly guarantees that live money custody, collection, and disbursement remain disabled.
 */
export class PendingSelectionProvider implements IPaymentProvider {
  readonly name = 'PENDING_SELECTION';

  isAvailable(): boolean {
    return false;
  }

  async createPaymentIntent(_input: PaymentIntentInput): Promise<PaymentIntentResult> {
    throw {
      statusCode: 503,
      code: 'PROVIDER_SELECTION_PENDING',
      message: 'Payment provider selection is currently pending. Live money collection is strictly disabled in TrustPay Enterprise.',
    };
  }

  async verifyWebhookSignature(_rawBody: string | Buffer, _signature: string): Promise<boolean> {
    return false;
  }
}

export const defaultPaymentProvider = new PendingSelectionProvider();

