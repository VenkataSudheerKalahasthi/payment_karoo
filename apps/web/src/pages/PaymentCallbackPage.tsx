import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import {
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  ArrowLeft,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

interface VerificationResult {
  id: string;
  orderId: string;
  cfOrderId?: string;
  status: string;
  cashfreeOrderStatus: string;
  amount: number;
  currency: string;
  contractNumber?: string;
  failureReason?: string;
  isLiveMoneyDisabled: boolean;
}

export const PaymentCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('order_id');

  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const verifyOrder = async (id: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await apiService.verifyPaymentStatus(id);
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setErrorMessage(res.error?.message || 'Payment status verification failed.');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect to verification server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      verifyOrder(orderId);
    } else {
      setIsLoading(false);
      setErrorMessage('Missing order_id in payment return URL.');
    }
  }, [orderId]);

  return (
    <div className="min-h-screen dark:bg-[#0B0D14] bg-[#F5F7FA] dark:text-[#E8ECF5] text-[#242424] flex flex-col justify-center items-center p-4 transition-colors">
      <div className="w-full max-w-md dark:bg-[#191B25] bg-white border dark:border-[#272B38] border-[#E2E8F0] rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b dark:border-[#272B38] border-[#E2E8F0] dark:bg-[#191D2A]/40 bg-[#F8FAFC] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold dark:text-[#E8ECF5] text-[#242424]">Cashfree Payment Checkout</h2>
              <span className="text-[10px] dark:text-[#9AA4B8] text-[#64748B] font-mono">SANDBOX VERIFICATION GATEWAY</span>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
            TEST MODE
          </span>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {isLoading && (
            <div className="py-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-[#2563EB] animate-spin mx-auto" />
              <div className="space-y-1">
                <p className="text-sm font-semibold dark:text-[#E8ECF5] text-[#242424]">Verifying Payment in Sandbox</p>
                <p className="text-xs dark:text-[#9AA4B8] text-[#475569]">
                  Querying authoritative Cashfree order status for Order #{orderId}...
                </p>
              </div>
            </div>
          )}

          {!isLoading && errorMessage && (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Verification Error</h3>
                <p className="text-xs text-red-500">{errorMessage}</p>
              </div>
              {orderId && (
                <button
                  onClick={() => verifyOrder(orderId)}
                  className="px-4 py-2 rounded-lg dark:bg-[#191D2A] bg-[#F1F5F9] hover:dark:bg-[#303030] hover:bg-[#E2E8F0] text-xs font-semibold dark:text-[#E8ECF5] text-[#242424] transition border dark:border-[#272B38] border-[#E2E8F0]"
                >
                  Retry Verification
                </button>
              )}
            </div>
          )}

          {!isLoading && result && (
            <div className="space-y-5">
              {result.status === 'SUCCEEDED' && (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Payment Verified in Sandbox</h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Cashfree test order was completed successfully.
                    </p>
                  </div>
                </div>
              )}

              {result.status === 'PROCESSING' && (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 mx-auto">
                    <Clock className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Payment Still Processing</h3>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Cashfree Sandbox reports order is active and awaiting test completion.
                    </p>
                  </div>
                </div>
              )}

              {result.status === 'FAILED' && (
                <div className="text-center space-y-3">
                  <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mx-auto">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold dark:text-[#E8ECF5] text-[#242424]">Payment Incomplete or Expired</h3>
                    <p className="text-xs text-red-500">
                      {result.failureReason || 'The payment was not completed on Cashfree Sandbox.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Order Metadata Details */}
              <div className="p-4 rounded-xl dark:bg-[#0B0D14] bg-[#F8FAFC] border dark:border-[#272B38] border-[#E2E8F0] space-y-2 text-xs font-mono">
                <div className="flex justify-between items-center dark:text-[#9AA4B8] text-[#64748B]">
                  <span>Order Reference:</span>
                  <span className="dark:text-[#E8ECF5] text-[#242424] font-semibold">{result.orderId}</span>
                </div>
                {result.cfOrderId && (
                  <div className="flex justify-between items-center dark:text-[#9AA4B8] text-[#64748B]">
                    <span>Cashfree CF ID:</span>
                    <span className="text-[#2563EB]">{result.cfOrderId}</span>
                  </div>
                )}
                <div className="flex justify-between items-center dark:text-[#9AA4B8] text-[#64748B]">
                  <span>Simulated Amount:</span>
                  <span className="text-emerald-500 font-bold tabular-nums">
                    {result.amount.toFixed(2)} {result.currency}
                  </span>
                </div>
                <div className="flex justify-between items-center dark:text-[#9AA4B8] text-[#64748B]">
                  <span>TrustPay Status:</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      result.status === 'SUCCEEDED'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : result.status === 'FAILED'
                        ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                        : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
              </div>

              {/* Security Invariant Notice */}
              <div className="p-3 rounded-lg dark:bg-[#191D2A] bg-[#EFF6FF] border dark:border-[#272B38] border-[#2563EB]/20 text-[11px] dark:text-[#9AA4B8] text-[#475569] flex items-start space-x-2">
                <ShieldCheck className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                <span>
                  <strong>Financial Isolation Guarantee:</strong> This transaction executed in sandbox test mode. No live money was debited from cards or bank accounts, and no production ledger movements occurred.
                </span>
              </div>
            </div>
          )}

          {/* Action Footer */}
          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-xs font-bold text-white transition flex items-center justify-center space-x-1.5 shadow-lg shadow-[#2563EB]/20"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Contracts Dashboard</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
