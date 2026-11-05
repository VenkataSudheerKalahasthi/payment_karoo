import { prisma } from '../../config/prisma.js';
import crypto from 'crypto';
import {
  PaymentTransactionType,
  PaymentTransactionStatus,
  Prisma,
  UserRole,
  ContractStatus,
  EscrowStatus,
  EscrowOperationalState,
  MilestoneStatus,
  NotificationType,
  LedgerTransactionType,
  LedgerEntryType,
} from '@prisma/client';
import { cashfreeProvider } from './cashfree.provider.js';
import { ledgerService } from '../ledger/ledger.service.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { emitContractRealtimeEvent } from '../realtime/socket.service.js';
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

    if (newStatus === PaymentTransactionStatus.SUCCEEDED) {
      await this.processConfirmedFunding({
        orderId: cfOrder.order_id,
        providerTransactionId: providerTransactionId || undefined,
        actorId: actor.id,
      });
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

  /**
   * Confirms payment funding, transitions escrow to FUNDED, allocates milestone amounts,
   * posts balanced double-entry ledger entries, and notifies participants.
   */
  async processConfirmedFunding(params: {
    orderId: string;
    providerTransactionId?: string;
    actorId?: string;
  }) {
    const { orderId, providerTransactionId, actorId } = params;

    const transaction = await prisma.paymentTransaction.findFirst({
      where: {
        OR: [{ providerOrderId: orderId }, { transactionReference: orderId }, { id: orderId }],
      },
      include: {
        contract: {
          include: {
            milestones: { orderBy: { order: 'asc' } },
            client: true,
            worker: true,
          },
        },
      },
    });

    if (!transaction) {
      throw {
        statusCode: 404,
        code: 'PAYMENT_NOT_FOUND',
        message: `Payment transaction "${orderId}" not found.`,
      };
    }

    const contract = transaction.contract;
    const currency = transaction.currency || contract.currency || 'USD';

    // 1. Update PaymentTransaction to SUCCEEDED
    await prisma.paymentTransaction.update({
      where: { id: transaction.id },
      data: {
        status: PaymentTransactionStatus.SUCCEEDED,
        providerTransactionId: providerTransactionId || transaction.providerTransactionId,
      },
    });

    // 2. Ensure or update EscrowRecord
    let escrow = await prisma.escrowRecord.findUnique({
      where: { contractId: contract.id },
      include: { milestoneAllocations: true },
    });

    if (!escrow) {
      let sumMilestones = 0n;
      const allocations = contract.milestones.map((m) => {
        const amt = BigInt(Math.round(Number(m.amount) * 100));
        sumMilestones += amt;
        return {
          milestoneId: m.id,
          allocatedAmountMinor: amt,
        };
      });

      escrow = await prisma.escrowRecord.create({
        data: {
          contractId: contract.id,
          status: EscrowStatus.FUNDED,
          currency,
          contractualAmountMinor: sumMilestones,
          expectedFundedAmountMinor: sumMilestones,
          fundedAmountMinor: transaction.amountMinor,
          allocatedAmountMinor: sumMilestones,
          releasedAmountMinor: 0n,
          refundedAmountMinor: 0n,
          operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
          disputeHold: false,
          milestoneAllocations: {
            create: allocations,
          },
        },
        include: { milestoneAllocations: true },
      });
    } else {
      await prisma.escrowRecord.update({
        where: { id: escrow.id },
        data: {
          status: EscrowStatus.FUNDED,
          fundedAmountMinor: transaction.amountMinor,
          operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
        },
      });

      // Ensure milestone allocations exist
      for (const m of contract.milestones) {
        const amt = BigInt(Math.round(Number(m.amount) * 100));
        await prisma.escrowMilestoneAllocation.upsert({
          where: { milestoneId: m.id },
          update: { allocatedAmountMinor: amt },
          create: {
            escrowRecordId: escrow.id,
            milestoneId: m.id,
            allocatedAmountMinor: amt,
          },
        });
      }
    }

    // 3. Post Double-Entry Ledger Entry
    try {
      await ledgerService.ensureSystemAccounts(currency);
      const cashAccount = ledgerService.getAccountCode('1000-CASH-ESCROW', currency);
      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);

      await ledgerService.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_DEPOSIT,
        currency,
        description: `Contract #${contract.contractNumber} escrow funding confirmed via verified payment.`,
        sourceType: 'PAYMENT_TRANSACTION',
        sourceId: transaction.id,
        idempotencyKey: `ledger_deposit_${transaction.id}`,
        entries: [
          {
            accountCode: cashAccount,
            entryType: LedgerEntryType.DEBIT,
            amountMinor: transaction.amountMinor,
          },
          {
            accountCode: liabilityAccount,
            entryType: LedgerEntryType.CREDIT,
            amountMinor: transaction.amountMinor,
          },
        ],
      });
    } catch (err) {
      logger.warn('[processConfirmedFunding] Ledger posting note:', err);
    }

    // 4. Record Escrow Activity
    await prisma.escrowActivity.create({
      data: {
        escrowRecordId: escrow.id,
        actorId: actorId || contract.clientId,
        operationalState: EscrowOperationalState.WORK_IN_PROGRESS,
        eventType: 'ESCROW_FUNDED',
        description: `Contract #${contract.contractNumber} escrow funding confirmed ($${Number(transaction.amountMinor) / 100} ${currency}).`,
        isLiveFinancialMovement: false,
      },
    });

    // 5. Notify Client and Specialist
    await notificationsService.createNotification({
      recipientId: contract.clientId,
      title: 'Contract Funded Successfully',
      message: `Your payment of $${Number(transaction.amountMinor) / 100} ${currency} for Contract #${contract.contractNumber} is confirmed and held in secure escrow.`,
      type: NotificationType.CONTRACT_UPDATE,
      metadata: { contractId: contract.id, transactionId: transaction.id },
    });

    if (contract.workerId) {
      await notificationsService.createNotification({
        recipientId: contract.workerId,
        title: 'Contract Funded - Ready to Begin Work',
        message: `Client funded Contract #${contract.contractNumber} in escrow. You may now commence milestone deliverables.`,
        type: NotificationType.CONTRACT_UPDATE,
        metadata: { contractId: contract.id, transactionId: transaction.id },
      });
    }

    // 6. Real-time event emission
    emitContractRealtimeEvent(contract.id, 'contract:funded', {
      contractId: contract.id,
      amountMinor: transaction.amountMinor.toString(),
      currency,
    });

    logger.info(`[FUNDING CONFIRMED] Contract ${contract.contractNumber} funded for ${transaction.amountMinor.toString()} minor units.`);
    return transaction;
  }

  /**
   * Settles an approved milestone to specialist, calculates platform commission,
   * posts double-entry ledger entries, and records settlement audit history.
   */
  async settleMilestone(params: {
    milestoneId: string;
    actor: { id: string; role: { name: UserRole } };
    reason?: string;
  }) {
    const { milestoneId, actor, reason } = params;

    const milestone = await prisma.contractMilestone.findUnique({
      where: { id: milestoneId },
      include: {
        contract: {
          include: {
            client: true,
            worker: true,
          },
        },
      },
    });

    if (!milestone) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Milestone not found' };
    }

    const contract = milestone.contract;
    const isClient = contract.clientId === actor.id;
    const isWorker = contract.workerId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isWorker && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Not authorized to settle this milestone.' };
    }

    if (milestone.status !== MilestoneStatus.APPROVED) {
      throw {
        statusCode: 400,
        code: 'MILESTONE_NOT_APPROVED',
        message: `Milestone must be in APPROVED status to settle (current: ${milestone.status}).`,
      };
    }

    if (contract.status === ContractStatus.DISPUTED) {
      throw {
        statusCode: 400,
        code: 'CONTRACT_DISPUTED',
        message: 'Cannot settle milestones on a disputed contract.',
      };
    }

    const escrow = await prisma.escrowRecord.findUnique({
      where: { contractId: contract.id },
      include: { milestoneAllocations: true },
    });

    if (!escrow || escrow.disputeHold) {
      throw {
        statusCode: 400,
        code: 'DISPUTE_HOLD_ACTIVE',
        message: 'Settlement is blocked while escrow is on dispute hold or uninitialized.',
      };
    }

    // Check duplicate settlement
    const existingSettlement = await prisma.paymentTransaction.findFirst({
      where: {
        contractId: contract.id,
        type: PaymentTransactionType.MILESTONE_RELEASE,
        status: PaymentTransactionStatus.SUCCEEDED,
        idempotencyKey: `settle_${milestone.id}`,
      },
    });

    if (existingSettlement) {
      throw {
        statusCode: 409,
        code: 'MILESTONE_ALREADY_SETTLED',
        message: `Milestone "${milestone.title}" has already been settled under reference ${existingSettlement.transactionReference}.`,
      };
    }

    // Commission calculation
    const config = await this.getPlatformConfig();
    const feePercentage = config.platformFeePercentage || 5.0;
    const grossAmountMinor = BigInt(Math.round(Number(milestone.amount) * 100));
    const commissionMinor = (grossAmountMinor * BigInt(Math.round(feePercentage * 100))) / 10000n;
    const specialistNetMinor = grossAmountMinor - commissionMinor;
    const currency = contract.currency || 'USD';

    const transactionReference = `SETTLE-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const idempotencyKey = `settle_${milestone.id}`;

    // Record PaymentTransaction
    const paymentTx = await prisma.paymentTransaction.create({
      data: {
        transactionReference,
        contractId: contract.id,
        payerId: contract.clientId,
        payeeId: contract.workerId,
        type: PaymentTransactionType.MILESTONE_RELEASE,
        status: PaymentTransactionStatus.SUCCEEDED,
        amountMinor: grossAmountMinor,
        currency,
        idempotencyKey,
        metadata: {
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          grossAmountMinor: grossAmountMinor.toString(),
          commissionMinor: commissionMinor.toString(),
          specialistNetMinor: specialistNetMinor.toString(),
          feePercentage,
          reason: reason || 'Milestone approved deliverable settlement',
        },
      },
    });

    // Post double-entry ledger entries
    try {
      await ledgerService.ensureSystemAccounts(currency);
      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);
      const feeRevenueAccount = ledgerService.getAccountCode('4000-PLATFORM-FEE-REVENUE', currency);
      const workerPayableAccount = ledgerService.getAccountCode('2100-WORKER-PAYABLE', currency);

      await ledgerService.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_RELEASE,
        currency,
        description: `Milestone settlement for "${milestone.title}" (Contract #${contract.contractNumber})`,
        sourceType: 'PAYMENT_TRANSACTION',
        sourceId: paymentTx.id,
        idempotencyKey: `ledger_${idempotencyKey}`,
        entries: [
          {
            accountCode: liabilityAccount,
            entryType: LedgerEntryType.DEBIT,
            amountMinor: grossAmountMinor,
          },
          {
            accountCode: feeRevenueAccount,
            entryType: LedgerEntryType.CREDIT,
            amountMinor: commissionMinor,
          },
          {
            accountCode: workerPayableAccount,
            entryType: LedgerEntryType.CREDIT,
            amountMinor: specialistNetMinor,
          },
        ],
      });
    } catch (err) {
      logger.warn('[settleMilestone] Ledger posting note:', err);
    }

    // Update milestone allocation
    await prisma.escrowMilestoneAllocation.updateMany({
      where: { milestoneId: milestone.id },
      data: {
        isReleased: true,
        releasedAmountMinor: grossAmountMinor,
        releasedAt: new Date(),
      },
    });

    // Record Escrow Activity
    await prisma.escrowActivity.create({
      data: {
        escrowRecordId: escrow.id,
        milestoneId: milestone.id,
        actorId: actor.id,
        operationalState: EscrowOperationalState.MILESTONE_APPROVED,
        eventType: 'MILESTONE_SETTLED',
        description: `Settlement of $${Number(specialistNetMinor) / 100} ${currency} recorded for specialist (Platform commission: $${Number(commissionMinor) / 100}).`,
        isLiveFinancialMovement: false,
      },
    });

    // Notifications
    await notificationsService.createNotification({
      recipientId: contract.workerId,
      title: 'Milestone Settlement Confirmed',
      message: `Settlement for milestone "${milestone.title}" processed: $${Number(specialistNetMinor) / 100} ${currency} net earnings ($${Number(commissionMinor) / 100} platform fee).`,
      type: NotificationType.CONTRACT_UPDATE,
      metadata: { contractId: contract.id, milestoneId: milestone.id, transactionId: paymentTx.id },
    });

    await notificationsService.createNotification({
      recipientId: contract.clientId,
      title: 'Milestone Settlement Recorded',
      message: `Settlement for milestone "${milestone.title}" ($${Number(grossAmountMinor) / 100} ${currency}) has been released from escrow.`,
      type: NotificationType.CONTRACT_UPDATE,
      metadata: { contractId: contract.id, milestoneId: milestone.id, transactionId: paymentTx.id },
    });

    return {
      milestoneId: milestone.id,
      contractId: contract.id,
      grossAmountMinor: grossAmountMinor.toString(),
      grossAmount: Number(grossAmountMinor) / 100,
      platformCommissionMinor: commissionMinor.toString(),
      platformCommission: Number(commissionMinor) / 100,
      feePercentage,
      specialistNetMinor: specialistNetMinor.toString(),
      specialistNet: Number(specialistNetMinor) / 100,
      currency,
      transactionReference,
      status: 'SUCCEEDED',
      settledAt: new Date().toISOString(),
    };
  }

  /**
   * Processes a verified refund on remaining contractual escrow balances.
   * Validates available refundable amount, posts double-entry refund ledger entry,
   * updates escrow record, and notifies participants.
   */
  async processRefund(params: {
    contractId: string;
    actor: { id: string; role: { name: UserRole } };
    amountMinor?: bigint | string;
    reason: string;
  }) {
    const { contractId, actor, reason } = params;

    if (!reason || reason.trim().length < 5) {
      throw {
        statusCode: 400,
        code: 'INVALID_REASON',
        message: 'A detailed justification (minimum 5 characters) is required for refund processing.',
      };
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { client: true, worker: true },
    });

    if (!contract) {
      throw { statusCode: 404, code: 'NOT_FOUND', message: 'Contract not found' };
    }

    const isClient = contract.clientId === actor.id;
    const isAdmin = actor.role.name === UserRole.ADMIN || actor.role.name === UserRole.SUPERADMIN;

    if (!isClient && !isAdmin) {
      throw { statusCode: 403, code: 'FORBIDDEN', message: 'Not authorized to initiate refunds for this contract.' };
    }

    const escrow = await prisma.escrowRecord.findUnique({
      where: { contractId },
    });

    if (!escrow) {
      throw { statusCode: 404, code: 'ESCROW_NOT_FOUND', message: 'Escrow record not found for this contract.' };
    }

    if (escrow.disputeHold && !isAdmin) {
      throw {
        statusCode: 400,
        code: 'DISPUTE_HOLD_ACTIVE',
        message: 'Refund is blocked while escrow is on protective dispute hold.',
      };
    }

    const availableRefundableMinor = escrow.fundedAmountMinor - escrow.releasedAmountMinor - escrow.refundedAmountMinor;

    if (availableRefundableMinor <= 0n) {
      throw {
        statusCode: 400,
        code: 'NO_REFUNDABLE_FUNDS',
        message: 'There are no remaining funded escrow balances available to refund for this contract.',
      };
    }

    const requestedMinor = params.amountMinor ? BigInt(params.amountMinor) : availableRefundableMinor;

    if (requestedMinor <= 0n) {
      throw { statusCode: 400, code: 'INVALID_AMOUNT', message: 'Refund amount must be positive.' };
    }

    if (requestedMinor > availableRefundableMinor) {
      throw {
        statusCode: 400,
        code: 'EXCEEDS_REFUNDABLE_AMOUNT',
        message: `Requested refund (${requestedMinor.toString()}) exceeds available refundable balance (${availableRefundableMinor.toString()}).`,
      };
    }

    const currency = escrow.currency || 'USD';
    const transactionReference = `REF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const idempotencyKey = `refund_${contract.id}_${Date.now()}`;

    // 1. Create PaymentTransaction
    const paymentTx = await prisma.paymentTransaction.create({
      data: {
        transactionReference,
        contractId: contract.id,
        payerId: contract.workerId || contract.clientId,
        payeeId: contract.clientId,
        type: PaymentTransactionType.REFUND,
        status: PaymentTransactionStatus.SUCCEEDED,
        amountMinor: requestedMinor,
        currency,
        idempotencyKey,
        metadata: {
          reason: reason.trim(),
          availableBeforeRefund: availableRefundableMinor.toString(),
        },
      },
    });

    // 2. Post Double-Entry Ledger Entry
    try {
      await ledgerService.ensureSystemAccounts(currency);
      const liabilityAccount = ledgerService.getAccountCode('2000-CLIENT-ESCROW-LIABILITY', currency);
      const cashAccount = ledgerService.getAccountCode('1000-CASH-ESCROW', currency);

      await ledgerService.postTransaction({
        transactionType: LedgerTransactionType.ESCROW_REFUND,
        currency,
        description: `Escrow refund to client for Contract #${contract.contractNumber}. Reason: ${reason.trim()}`,
        sourceType: 'PAYMENT_TRANSACTION',
        sourceId: paymentTx.id,
        idempotencyKey: `ledger_${idempotencyKey}`,
        entries: [
          {
            accountCode: liabilityAccount,
            entryType: LedgerEntryType.DEBIT,
            amountMinor: requestedMinor,
          },
          {
            accountCode: cashAccount,
            entryType: LedgerEntryType.CREDIT,
            amountMinor: requestedMinor,
          },
        ],
      });
    } catch (err) {
      logger.warn('[processRefund] Ledger posting note:', err);
    }

    // 3. Update EscrowRecord
    const newRefundedTotal = escrow.refundedAmountMinor + requestedMinor;
    const remainingAfter = escrow.fundedAmountMinor - escrow.releasedAmountMinor - newRefundedTotal;
    const nextStatus = remainingAfter <= 0n ? EscrowStatus.REFUNDED : EscrowStatus.PARTIALLY_REFUNDED;
    const nextOpState = nextStatus === EscrowStatus.REFUNDED ? EscrowOperationalState.TERMINATED : escrow.operationalState;

    await prisma.escrowRecord.update({
      where: { id: escrow.id },
      data: {
        refundedAmountMinor: newRefundedTotal,
        status: nextStatus,
        operationalState: nextOpState,
      },
    });

    // 4. Record Escrow Activity
    await prisma.escrowActivity.create({
      data: {
        escrowRecordId: escrow.id,
        actorId: actor.id,
        operationalState: nextOpState,
        eventType: 'REFUND_PROCESSED',
        description: `Refund of $${Number(requestedMinor) / 100} ${currency} processed. Reason: ${reason.trim()}`,
        isLiveFinancialMovement: false,
      },
    });

    // 5. Notifications
    await notificationsService.createNotification({
      recipientId: contract.clientId,
      title: 'Escrow Refund Confirmed',
      message: `A refund of $${Number(requestedMinor) / 100} ${currency} for Contract #${contract.contractNumber} has been processed.`,
      type: NotificationType.CONTRACT_UPDATE,
      metadata: { contractId: contract.id, transactionId: paymentTx.id },
    });

    if (contract.workerId) {
      await notificationsService.createNotification({
        recipientId: contract.workerId,
        title: 'Escrow Refund Recorded',
        message: `An escrow refund of $${Number(requestedMinor) / 100} ${currency} was recorded for Contract #${contract.contractNumber}. Reason: ${reason.trim()}`,
        type: NotificationType.CONTRACT_UPDATE,
        metadata: { contractId: contract.id, transactionId: paymentTx.id },
      });
    }

    return {
      contractId: contract.id,
      refundAmountMinor: requestedMinor.toString(),
      refundAmount: Number(requestedMinor) / 100,
      currency,
      transactionReference,
      escrowStatus: nextStatus,
      remainingInEscrowMinor: remainingAfter.toString(),
      refundedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculates comprehensive virtual wallet metrics derived from ledger and transactional records.
   */
  async getWalletOverview(user: { id: string; role: { name: UserRole } }) {
    const isClient = user.role.name === UserRole.CLIENT;

    if (isClient) {
      const contracts = await prisma.contract.findMany({
        where: { clientId: user.id },
        include: {
          escrowRecord: true,
          milestones: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const transactions = await prisma.paymentTransaction.findMany({
        where: { payerId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      let totalContractFundingMinor = 0n;
      let activeContractFundingMinor = 0n;
      let allocatedMilestoneMinor = 0n;
      let pendingContractFundingMinor = 0n;
      let completedMilestoneMinor = 0n;
      let totalRefundedMinor = 0n;

      const contractItems = contracts.map((c) => {
        const agreedMinor = BigInt(Math.round(Number(c.totalAmount) * 100));
        const fundedMinor = c.escrowRecord ? c.escrowRecord.fundedAmountMinor : 0n;
        const releasedMinor = c.escrowRecord ? c.escrowRecord.releasedAmountMinor : 0n;
        const refundedMinor = c.escrowRecord ? c.escrowRecord.refundedAmountMinor : 0n;
        const remainingMinor = fundedMinor - releasedMinor - refundedMinor;

        if (c.escrowRecord?.status === EscrowStatus.FUNDED || c.escrowRecord?.status === EscrowStatus.PARTIALLY_RELEASED) {
          activeContractFundingMinor += remainingMinor > 0n ? remainingMinor : 0n;
        }

        if (c.status === ContractStatus.ACTIVE && (!c.escrowRecord || c.escrowRecord.status === EscrowStatus.PENDING_FUNDING || c.escrowRecord.status === EscrowStatus.NOT_INITIALIZED)) {
          pendingContractFundingMinor += agreedMinor;
        }

        for (const m of c.milestones) {
          allocatedMilestoneMinor += BigInt(Math.round(Number(m.amount) * 100));
          if (m.status === MilestoneStatus.APPROVED) {
            completedMilestoneMinor += BigInt(Math.round(Number(m.amount) * 100));
          }
        }

        return {
          contractId: c.id,
          contractNumber: c.contractNumber,
          title: c.title,
          status: c.status,
          currency: c.currency || 'USD',
          totalAgreedAmount: Number(agreedMinor) / 100,
          fundedAmount: Number(fundedMinor) / 100,
          releasedAmount: Number(releasedMinor) / 100,
          refundedAmount: Number(refundedMinor) / 100,
          remainingInEscrow: Number(remainingMinor > 0n ? remainingMinor : 0n) / 100,
          escrowStatus: c.escrowRecord?.status || EscrowStatus.NOT_INITIALIZED,
        };
      });

      for (const t of transactions) {
        if (t.type === PaymentTransactionType.ESCROW_FUNDING && t.status === PaymentTransactionStatus.SUCCEEDED) {
          totalContractFundingMinor += t.amountMinor;
        } else if (t.type === PaymentTransactionType.REFUND && t.status === PaymentTransactionStatus.SUCCEEDED) {
          totalRefundedMinor += t.amountMinor;
        }
      }

      return {
        role: 'CLIENT' as const,
        currency: 'USD',
        totalContractFundingMinor: totalContractFundingMinor.toString(),
        totalContractFunding: Number(totalContractFundingMinor) / 100,
        activeContractFundingMinor: activeContractFundingMinor.toString(),
        activeContractFunding: Number(activeContractFundingMinor) / 100,
        allocatedMilestoneMinor: allocatedMilestoneMinor.toString(),
        allocatedMilestoneAmount: Number(allocatedMilestoneMinor) / 100,
        pendingContractFundingMinor: pendingContractFundingMinor.toString(),
        pendingContractFunding: Number(pendingContractFundingMinor) / 100,
        completedMilestoneMinor: completedMilestoneMinor.toString(),
        completedMilestoneAmount: Number(completedMilestoneMinor) / 100,
        totalRefundedMinor: totalRefundedMinor.toString(),
        totalRefundedAmount: Number(totalRefundedMinor) / 100,
        contracts: contractItems,
        recentTransactions: transactions.map((t) => ({
          id: t.id,
          transactionReference: t.transactionReference,
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
          metadata: t.metadata as Record<string, unknown> | null,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    } else {
      // Specialist / Worker
      const contracts = await prisma.contract.findMany({
        where: { workerId: user.id },
        include: {
          escrowRecord: true,
          milestones: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      const transactions = await prisma.paymentTransaction.findMany({
        where: { payeeId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      let totalContractValueMinor = 0n;
      let pendingMilestoneEarningsMinor = 0n;
      let submittedMilestoneAmountMinor = 0n;
      let approvedMilestoneAmountMinor = 0n;
      let disputedOrHeldAmountMinor = 0n;
      let settlementInitiatedMinor = 0n;
      let settledEarningsMinor = 0n;
      let platformCommissionMinor = 0n;

      for (const c of contracts) {
        totalContractValueMinor += BigInt(Math.round(Number(c.totalAmount) * 100));
        const isDisputed = c.status === ContractStatus.DISPUTED || Boolean(c.escrowRecord?.disputeHold);

        for (const m of c.milestones) {
          const amtMinor = BigInt(Math.round(Number(m.amount) * 100));
          if (isDisputed) {
            disputedOrHeldAmountMinor += amtMinor;
          } else if (m.status === MilestoneStatus.PENDING || m.status === MilestoneStatus.IN_PROGRESS || m.status === MilestoneStatus.IN_REVISION) {
            pendingMilestoneEarningsMinor += amtMinor;
          } else if (m.status === MilestoneStatus.SUBMITTED) {
            submittedMilestoneAmountMinor += amtMinor;
          } else if (m.status === MilestoneStatus.APPROVED) {
            approvedMilestoneAmountMinor += amtMinor;
          }
        }
      }

      for (const t of transactions) {
        if (t.type === PaymentTransactionType.MILESTONE_RELEASE) {
          const meta = (t.metadata as Record<string, unknown>) || {};
          const comm = meta.commissionMinor ? BigInt(meta.commissionMinor as string) : 0n;
          const net = meta.specialistNetMinor ? BigInt(meta.specialistNetMinor as string) : (t.amountMinor - comm);

          if (t.status === PaymentTransactionStatus.SUCCEEDED) {
            settledEarningsMinor += net;
            platformCommissionMinor += comm;
          } else if (t.status === PaymentTransactionStatus.PROCESSING || t.status === PaymentTransactionStatus.INITIATED) {
            settlementInitiatedMinor += t.amountMinor;
          }
        }
      }

      return {
        role: 'WORKER' as const,
        currency: 'USD',
        totalContractValueMinor: totalContractValueMinor.toString(),
        totalContractValue: Number(totalContractValueMinor) / 100,
        pendingMilestoneEarningsMinor: pendingMilestoneEarningsMinor.toString(),
        pendingMilestoneEarnings: Number(pendingMilestoneEarningsMinor) / 100,
        submittedMilestoneAmountMinor: submittedMilestoneAmountMinor.toString(),
        submittedMilestoneAmount: Number(submittedMilestoneAmountMinor) / 100,
        approvedMilestoneAmountMinor: approvedMilestoneAmountMinor.toString(),
        approvedMilestoneAmount: Number(approvedMilestoneAmountMinor) / 100,
        disputedOrHeldAmountMinor: disputedOrHeldAmountMinor.toString(),
        disputedOrHeldAmount: Number(disputedOrHeldAmountMinor) / 100,
        settlementInitiatedMinor: settlementInitiatedMinor.toString(),
        settlementInitiatedAmount: Number(settlementInitiatedMinor) / 100,
        settledEarningsMinor: settledEarningsMinor.toString(),
        settledEarnings: Number(settledEarningsMinor) / 100,
        platformCommissionMinor: platformCommissionMinor.toString(),
        platformCommission: Number(platformCommissionMinor) / 100,
        contractsCount: contracts.length,
        recentTransactions: transactions.map((t) => ({
          id: t.id,
          transactionReference: t.transactionReference,
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
          metadata: t.metadata as Record<string, unknown> | null,
          createdAt: t.createdAt.toISOString(),
        })),
      };
    }
  }
}

export const paymentsService = new PaymentsService();

