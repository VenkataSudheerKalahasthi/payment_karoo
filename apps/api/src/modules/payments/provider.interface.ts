export interface PaymentIntentInput {
  amountMinor: bigint | number;
  currency: string;
  contractId: string;
  payerId: string;
  payeeId?: string | null;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentIntentResult {
  provider: string;
  providerTransactionId: string;
  status: string;
  requiresAction: boolean;
  clientSecret?: string;
}

export interface IPaymentProvider {
  readonly name: string;
  isAvailable(): boolean;
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verifyWebhookSignature(rawBody: string | Buffer, signature: string, timestamp?: string): Promise<boolean>;
}

