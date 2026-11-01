import { prisma } from '../../config/prisma.js';
import crypto from 'crypto';
import {
  PaymentTransactionType,
  PaymentTransactionStatus,
  Prisma,
  UserRole,
  ContractStatus,
} from '@prisma/client';
import { cashfreeProvider } from './cashfree.provider.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.config.js';

export class PaymentsService {
  /**
   * Retrieves platform financial configuration.
   */
  async getPlatformConfig() {
    const config = await prisma.platformFinancialConfig.findFirst();
    if (!config) {
      return {
        platformFeePercentage: 5.0,
        fixedFeeMinor: '0',
        supportedCurrencies: ['INR', 'USD', 'EUR'],
        activeProvider: 'CASHFREE',
        isLiveMoneyDisabled: true,
      };
    }
    return {
      id: config.id,
      platformFeePercentage: Number(config.platformFeePercentage),
      fixedFeeMinor: config.fixedFeeMinor.toString(),
      supportedCurrencies: config.supportedCurrencies,
      activeProvider: config.activeProvider === 'PENDING_SELECTION' ? 'CASHFREE' : config.activeProvider,
      isLiveMoneyDisabled: config.isLiveMoneyDisabled,
      updatedAt: config.updatedAt.toISOString(),
      providerStatus: {
        provider: 'CASHFREE',
        environment: 'SANDBOX',
        isConfigured: cashfreeProvider.isAvailable(),
        apiVersion: env.CASHFREE_API_VERSION,
        liveCustodyDisabled: true,
      },
    };
  }

  /**
   * Creates a Cashfree Sandbox Payment Order for an eligible accepted contract.
   * Strictly calculates amounts on backend from verified contract terms.
   */
  async createPaymentOrder(params: {
    contractId: string;
    actor: { id: string; role: { name: UserRole } };
    idempotencyKey?: string;
  }) {
    const { contractId, actor } = params;

    // 1. Fetch contract with milestones, client, worker, and digital acceptances
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        milestones: { orderBy: { order: 'asc' } },
        client: { select: { id: true, firstName: true, lastName: true, email: true } },
        worker: { select: { id: true, firstName: true, lastName: true, email: true } },
        acceptances: true,
      },
    });

    if (!contract) {
      throw {
        statusCode: 404,
        code: 'CONTRACT_NOT_FOUND',
        message: `Contract "${contractId}" was not found.`,
      };
    }

    // 2. Authorization: Only the contract's Client or Superadmin can initiate payments
    const isClient = contract.clientId === actor.id;
    const isSuperadmin = actor.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isSuperadmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Only the client assigned to this contract may initiate escrow payments.',
      };
    }

    // 3. Strict Status & Mutual Acceptance Check
    if (contract.status === ContractStatus.PENDING_ACCEPTANCE) {
      throw {
        statusCode: 400,
        code: 'CONTRACT_NOT_ACTIVATED',
        message:
          'Contracts in PENDING_ACCEPTANCE status cannot receive payment orders. Both client and specialist must first accept the contract.',
      };
    }

    if (contract.status === ContractStatus.DISPUTED) {
      throw {
        statusCode: 400,
        code: 'CONTRACT_DISPUTED',
        message:
          'Contracts currently under dispute cannot receive new payment orders unless resolved by governance.',
      };
    }

    if (contract.status !== ContractStatus.ACTIVE) {
      throw {
        statusCode: 400,
        code: 'INVALID_CONTRACT_STATUS',
        message: `Payments cannot be initiated for contract in status "${contract.status}". Only ACTIVE mutually accepted contracts are eligible.`,
      };
    }

    // Both client and worker must have accepted the CURRENT version
    const clientAccepted = contract.acceptances?.some(
      (a) => a.userId === contract.clientId && a.version === contract.version,
    );
    const workerAccepted = contract.acceptances?.some(
      (a) => a.userId === contract.workerId && a.version === contract.version,
    );

    if (!clientAccepted || !workerAccepted) {
      throw {
        statusCode: 400,
        code: 'CONTRACT_NOT_MUTUALLY_ACCEPTED',
        message: `Payment orders require mutual digital acceptance of the current contract version (${contract.version}) by both client and specialist.`,
      };
    }

    // 4. Derive contractual amount strictly from Supabase milestones
    if (!contract.milestones || contract.milestones.length === 0) {
      throw {
        statusCode: 400,
        code: 'NO_MILESTONES',
        message: 'Contract does not have any milestones to fund.',
      };
    }

    let totalAmount = 0;
    for (const m of contract.milestones) {
      const amt = Number(m.amount);
      if (amt <= 0) {
        throw {
          statusCode: 400,
          code: 'INVALID_MILESTONE_AMOUNT',
          message: `Milestone "${m.title}" has invalid non-positive amount (${amt}).`,
        };
      }
      totalAmount += amt;
    }

    // Currency handling: Cashfree Sandbox processes INR seamlessly
    const currency = 'INR';
    const amountMinor = BigInt(Math.round(totalAmount * 100));

    // 5. Idempotency Check
    const idempotencyKey = params.idempotencyKey || `order_${contract.id}_${contract.contractNumber}`;
    const existingTransaction = await prisma.paymentTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      const meta = (existingTransaction.metadata as Record<string, unknown>) || {};
      if (
        (existingTransaction.status === PaymentTransactionStatus.INITIATED ||
          existingTransaction.status === PaymentTransactionStatus.PROCESSING) &&
        meta.paymentSessionId
      ) {
        logger.info(`[PAYMENT IDEMPOTENT] Reusing active session for order ${existingTransaction.providerOrderId}`);
        return {
          orderId: existingTransaction.providerOrderId || existingTransaction.transactionReference,
          paymentSessionId: meta.paymentSessionId as string,
          amountMinor: existingTransaction.amountMinor.toString(),
          amount: Number(existingTransaction.amountMinor) / 100,
          currency: existingTransaction.currency,
          environment: 'SANDBOX',
          contractId: contract.id,
          status: existingTransaction.status,
          reused: true,
        };
      }
    }

    // 6. Generate unique TrustPay & Cashfree order identifiers
    const uniqueSuffix = crypto.randomBytes(4).toString('hex');
    const orderId = `tp_${contract.contractNumber.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${uniqueSuffix}`;
    const transactionReference = `TX-${Date.now()}-${uniqueSuffix.toUpperCase()}`;

    const clientEmail = contract.client.email || 'client@trustpay.internal';
    const clientName =
      `${contract.client.firstName || ''} ${contract.client.lastName || ''}`.trim() || 'TrustPay Client';

    // 7. Request Cashfree Sandbox Order
    const cashfreeOrder = await cashfreeProvider.createOrder({
      orderId,
      orderAmount: totalAmount,
      orderCurrency: currency,
      customerId: contract.client.id,
      customerEmail: clientEmail,
      customerName: clientName,
      orderNote: `TrustPay Contract #${contract.contractNumber} Milestone Escrow (SANDBOX)`,
    });

    // 8. Persist PaymentTransaction record
    const paymentTransaction = await prisma.paymentTransaction.create({
      data: {
        transactionReference,
        contractId: contract.id,
        payerId: contract.clientId,
        payeeId: contract.workerId,
        type: PaymentTransactionType.ESCROW_FUNDING,
        status: PaymentTransactionStatus.INITIATED,
        amountMinor,
        currency,
        provider: 'CASHFREE',
        providerOrderId: cashfreeOrder.orderId,
        providerTransactionId: cashfreeOrder.cfOrderId,
        idempotencyKey,
        metadata: {
          paymentSessionId: cashfreeOrder.paymentSessionId,
          cfOrderId: cashfreeOrder.cfOrderId,
          mode: 'SANDBOX',
          contractNumber: contract.contractNumber,
        },
      },
    });

    logger.info(
      `[PAYMENT ORDER CREATED] TrustPay Ref: ${paymentTransaction.transactionReference}, Cashfree Order: ${cashfreeOrder.orderId}, Session: ${cashfreeOrder.paymentSessionId}`,
    );

    return {
      orderId: cashfreeOrder.orderId,
      paymentSessionId: cashfreeOrder.paymentSessionId,
      amountMinor: amountMinor.toString(),
      amount: totalAmount,
      currency,
      environment: 'SANDBOX',
      contractId: contract.id,
      transactionReference: paymentTransaction.transactionReference,
      status: paymentTransaction.status,
    };
  }

  /**
   * Verifies payment status directly from Cashfree Sandbox.
   * Strictly read-only financial verification without live money custody movement.
   */
  async verifyPaymentStatus(params: {
    orderId: string;
    actor: { id: string; role: { name: UserRole } };
  }) {
    const { orderId, actor } = params;

    // 1. Locate PaymentTransaction by providerOrderId or transactionReference
    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ providerOrderId: orderId }, { transactionReference: orderId }, { id: orderId }],
      },
      include: {
        contract: {
          select: {
            id: true,
            contractNumber: true,
            clientId: true,
            workerId: true,
            title: true,
          },
        },
      },
    });

    if (!transaction) {
      throw {
        statusCode: 404,
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment transaction for order "${orderId}" was not found.`,
      };
    }

    // 2. Authorization: Client, Worker, Admin, or Superadmin
    const isPayer = transaction.payerId === actor.id;
    const isPayee = transaction.payeeId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isPayer && !isPayee && !isAdmin) {
      throw {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You are not authorized to inspect this payment record.',
      };
    }

    // 3. Query Cashfree Sandbox API for authoritative status
    const cfOrderId = transaction.providerOrderId || orderId;
    const cfOrder = await cashfreeProvider.getOrder(cfOrderId);
    const cfPayments = await cashfreeProvider.getOrderPayments(cfOrderId);

    // 4. Reconciliation: Verify order ID, amount, and currency match
    if (transaction.providerOrderId && cfOrder.order_id !== transaction.providerOrderId) {
      logger.error(
        `[PAYMENT RECONCILIATION ERROR] Order ID mismatch: Cashfree reported ${cfOrder.order_id}, TrustPay has ${transaction.providerOrderId}`,
      );
      throw {
        statusCode: 400,
        code: 'PROVIDER_ORDER_ID_MISMATCH',
        message: 'Cashfree order ID does not match transaction record.',
      };
    }

    const expectedAmount = Number(transaction.amountMinor) / 100;
    if (Math.abs(Number(cfOrder.order_amount) - expectedAmount) > 0.01) {
      logger.error(
        `[PAYMENT RECONCILIATION ERROR] Amount mismatch: Expected ${expectedAmount}, Cashfree reported ${cfOrder.order_amount}`,
      );
      throw {
        statusCode: 400,
        code: 'PAYMENT_AMOUNT_MISMATCH',
        message: `Cashfree order amount (${cfOrder.order_amount}) does not match contractual record (${expectedAmount}).`,
      };
    }

    if (cfOrder.order_currency !== transaction.currency) {
      logger.error(
        `[PAYMENT RECONCILIATION ERROR] Currency mismatch: Expected ${transaction.currency}, Cashfree reported ${cfOrder.order_currency}`,
      );
      throw {
        statusCode: 400,
        code: 'PAYMENT_CURRENCY_MISMATCH',
        message: `Cashfree order currency (${cfOrder.order_currency}) does not match contractual record (${transaction.currency}).`,
      };
    }

    // 5. Map Cashfree status to TrustPay PaymentTransactionStatus
    // If transaction is already SUCCEEDED, it cannot be downgraded by delayed status queries
    let newStatus = transaction.status;
    let failureReason = transaction.failureReason;
    let providerTransactionId = transaction.providerTransactionId;

    if (transaction.status === PaymentTransactionStatus.SUCCEEDED) {
      // Terminal verified state preserved
      newStatus = PaymentTransactionStatus.SUCCEEDED;
    } else if (cfOrder.order_status === 'PAID') {
      newStatus = PaymentTransactionStatus.SUCCEEDED;
      const successfulPayment = cfPayments.find((p) => p.payment_status === 'SUCCESS');
      if (successfulPayment) {
        providerTransactionId = successfulPayment.cf_payment_id;
      }
    } else if (cfOrder.order_status === 'ACTIVE') {
      // Check if any payment attempt was successful
      const successfulPayment = cfPayments.find((p) => p.payment_status === 'SUCCESS');
      if (successfulPayment) {
        newStatus = PaymentTransactionStatus.SUCCEEDED;
        providerTransactionId = successfulPayment.cf_payment_id;
      } else {
        newStatus = PaymentTransactionStatus.PROCESSING;
      }
    } else if (cfOrder.order_status === 'EXPIRED') {
      newStatus = PaymentTransactionStatus.FAILED;
      failureReason = 'Order expired without completed payment';
    } else {
      // Safe fallback for unknown provider states
      logger.warn(`[CASHFREE UNKNOWN STATUS] Encountered unrecognized status "${cfOrder.order_status}" for order ${cfOrderId}`);
    }

    // 6. Update transaction state idempotently
    if (newStatus !== transaction.status || providerTransactionId !== transaction.providerTransactionId) {
      await prisma.paymentTransaction.update({
        where: { id: transaction.id },
        data: {
          status: newStatus,
          providerTransactionId,
          failureReason,
        },
      });
      logger.info(`[PAYMENT STATUS UPDATED] Order: ${cfOrderId} transitioned from ${transaction.status} to ${newStatus}`);
    }

    return {
      id: transaction.id,
      transactionReference: transaction.transactionReference,
      orderId: cfOrder.order_id,
      cfOrderId: cfOrder.cf_order_id,
      status: newStatus,
      cashfreeOrderStatus: cfOrder.order_status,
      amount: cfOrder.order_amount,
      currency: cfOrder.order_currency,
      provider: 'CASHFREE',
      environment: 'SANDBOX',
      contractId: transaction.contractId,
      contractNumber: transaction.contract.contractNumber,
      payments: cfPayments,
      failureReason,
      isLiveMoneyDisabled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Lists payment transactions with filters and pagination.
   */
  async listPaymentTransactions(filter: {
    page?: number;
    limit?: number;
    contractId?: string;
    payerId?: string;
    payeeId?: string;
    type?: PaymentTransactionType;
    status?: PaymentTransactionStatus;
  }) {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentTransactionWhereInput = {};
    if (filter.contractId) where.contractId = filter.contractId;
    if (filter.payerId) where.payerId = filter.payerId;
    if (filter.payeeId) where.payeeId = filter.payeeId;
    if (filter.type) where.type = filter.type;
    if (filter.status) where.status = filter.status;

    const [total, transactions] = await Promise.all([
      prisma.paymentTransaction.count({ where }),
      prisma.paymentTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          contract: { select: { contractNumber: true, title: true } },
          payer: { select: { firstName: true, lastName: true, email: true } },
          payee: { select: { firstName: true, lastName: true, email: true } },
        },
      }),
    ]);

    const items = transactions.map((t) => ({
      id: t.id,
      transactionReference: t.transactionReference,
      escrowRecordId: t.escrowRecordId,
      contractId: t.contractId,
      payerId: t.payerId,
      payeeId: t.payeeId,
      type: t.type,
      status: t.status,
      amountMinor: t.amountMinor.toString(),
      currency: t.currency,
      provider: t.provider,
      providerTransactionId: t.providerTransactionId,
      failureReason: t.failureReason,
      idempotencyKey: t.idempotencyKey,
      payerName: t.payer ? `${t.payer.firstName || ''} ${t.payer.lastName || ''}`.trim() || t.payer.email : undefined,
      payeeName: t.payee ? `${t.payee.firstName || ''} ${t.payee.lastName || ''}`.trim() || t.payee.email : undefined,
      contractNumber: t.contract?.contractNumber,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves single payment transaction by reference.
   */
  async getTransactionByReference(reference: string) {
    const t = await prisma.paymentTransaction.findUnique({
      where: { transactionReference: reference },
      include: {
        contract: { select: { contractNumber: true, title: true } },
        payer: { select: { firstName: true, lastName: true, email: true } },
        payee: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!t) return null;

    return {
      id: t.id,
      transactionReference: t.transactionReference,
      escrowRecordId: t.escrowRecordId,
      contractId: t.contractId,
      payerId: t.payerId,
      payeeId: t.payeeId,
      type: t.type,
      status: t.status,
      amountMinor: t.amountMinor.toString(),
      currency: t.currency,
      provider: t.provider,
      providerTransactionId: t.providerTransactionId,
      failureReason: t.failureReason,
      idempotencyKey: t.idempotencyKey,
      payerName: t.payer ? `${t.payer.firstName || ''} ${t.payer.lastName || ''}`.trim() || t.payer.email : undefined,
      payeeName: t.payee ? `${t.payee.firstName || ''} ${t.payee.lastName || ''}`.trim() || t.payee.email : undefined,
      contractNumber: t.contract?.contractNumber,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }
}

export const paymentsService = new PaymentsService();

