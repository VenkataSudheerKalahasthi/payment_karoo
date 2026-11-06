import React, { useState, useEffect, useMemo } from 'react';
import {
  Stamp,
  CheckCircle2,
  AlertCircle,
  FileText,
  Download,
  RefreshCw,
  Phone,
  User,
  Calendar,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Info,
  Check,
  Sparkles,
} from 'lucide-react';
import { apiService } from '../services/api';
import {
  ContractDto,
  ContractStatus,
  ClientStampDto,
  ClientStampPreviewDto,
} from '@trustpay/shared';

interface ClientStampConsoleProps {
  onNavigateToContract?: (contractId: string) => void;
}

export const ClientStampConsole: React.FC<ClientStampConsoleProps> = ({ onNavigateToContract }) => {
  const [previewData, setPreviewData] = useState<ClientStampPreviewDto | null>(null);
  const [contracts, setContracts] = useState<ContractDto[]>([]);
  const [stampHistory, setStampHistory] = useState<ClientStampDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [stampPosition, setStampPosition] = useState<'BOTTOM_RIGHT' | 'BOTTOM_LEFT' | 'BOTTOM_CENTER'>('BOTTOM_RIGHT');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadingContractId, setDownloadingContractId] = useState<string | null>(null);

  // Quick edit for phone number if empty
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneNumberInput, setPhoneNumberInput] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setStatusMessage(null);

      const [previewRes, contractsRes, historyRes] = await Promise.all([
        apiService.getClientStampPreview(),
        apiService.listContracts(),
        apiService.listClientStampHistory(),
      ]);

      if (previewRes.success && previewRes.data) {
        setPreviewData(previewRes.data);
        setPhoneNumberInput(previewRes.data.verifiedMobile || '');
      }

      if (contractsRes.success && contractsRes.data) {
        setContracts(contractsRes.data);
        // Default select first approved contract
        const approved = contractsRes.data.filter(
          (c) => c.status === ContractStatus.ACTIVE || c.status === ContractStatus.COMPLETED
        );
        if (approved.length > 0 && !selectedContractId) {
          setSelectedContractId(approved[0].id);
        }
      }

      if (historyRes.success && historyRes.data) {
        setStampHistory(historyRes.data.items || []);
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Failed to initialize Client Stamp Console',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Approved contracts eligible for stamp
  const eligibleContracts = useMemo(() => {
    return contracts.filter(
      (c) => c.status === ContractStatus.ACTIVE || c.status === ContractStatus.COMPLETED
    );
  }, [contracts]);

  const selectedContract = useMemo(() => {
    return contracts.find((c) => c.id === selectedContractId);
  }, [contracts, selectedContractId]);

  const selectedContractHasStamp = useMemo(() => {
    if (!selectedContract) return false;
    return stampHistory.some(
      (s) => s.contractId === selectedContract.id && s.pdfVersion === selectedContract.version && s.status === 'APPLIED'
    );
  }, [selectedContract, stampHistory]);

  // Handle Save Phone
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberInput.trim()) {
      alert('Please enter a valid phone number');
      return;
    }

    try {
      setSavingPhone(true);
      const res = await apiService.updateProfile({ phoneNumber: phoneNumberInput.trim() });
      if (res.success) {
        setEditingPhone(false);
        await fetchData();
        setStatusMessage({ type: 'success', text: 'Verified mobile number updated successfully!' });
      } else {
        alert(res.error?.message || 'Failed to update phone number');
      }
    } catch (err: any) {
      alert(err?.message || 'Error updating phone number');
    } finally {
      setSavingPhone(false);
    }
  };

  // Handle Apply Stamp
  const handleApplyStamp = async () => {
    if (!selectedContractId) {
      alert('Please select an approved contract first.');
      return;
    }

    if (!previewData?.isMobileVerified && !phoneNumberInput.trim()) {
      setStatusMessage({
        type: 'error',
        text: 'A verified mobile number is required before applying the official office stamp. Please update your profile.',
      });
      setEditingPhone(true);
      return;
    }

    try {
      setApplying(true);
      setStatusMessage(null);
      const res = await apiService.applyClientStamp(selectedContractId, {
        stampPosition,
      });

      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: `Official TrustPay Office Stamp applied successfully to Contract #${selectedContract?.contractNumber || ''}! The updated shared PDF is now available.`,
        });
        await fetchData();
      } else {
        setStatusMessage({
          type: 'error',
          text: res.error?.message || 'Failed to apply office stamp',
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.response?.data?.error?.message || err?.message || 'Error applying office stamp',
      });
    } finally {
      setApplying(false);
    }
  };

  // Handle Download PDF
  const handleDownloadPdf = async (contractId: string, contractNumber: string) => {
    try {
      setDownloadingContractId(contractId);
      const blob = await apiService.downloadContractPdf(contractId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Contract-${contractNumber}-OFFICIAL-STAMPED.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err?.message || 'Failed to download contract PDF');
    } finally {
      setDownloadingContractId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 p-6 rounded-2xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl dark:bg-[#8BFF24]/10 bg-[#EEF2FF] border dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center justify-center">
            <Stamp className="w-5 h-5 dark:text-[#8BFF24] text-[#5046E5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold dark:text-white text-slate-900 tracking-tight">Client Digital Office Stamp</h1>
              <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] dark:border-[#8BFF24]/30 border-[#C7D2FE]">
                Official Seal
              </span>
            </div>
            <p className="text-sm dark:text-zinc-400 text-slate-500 mt-0.5">
              Apply your official TrustPay circular office stamp to approved digital contracts for verifiable authority.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl dark:bg-[#1e201e] bg-slate-100 border dark:border-[#2e322e] border-slate-200 dark:text-zinc-300 text-slate-700 hover:dark:text-white hover:text-slate-900 hover:dark:border-[#8BFF24]/40 hover:border-[#5046E5]/40 transition text-sm font-medium shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center gap-3 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          )}
          <p>{statusMessage.text}</p>
        </div>
      )}

      {/* Main Grid: Stamp Preview & Application Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Official Stamp Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 p-6 rounded-2xl space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b dark:border-[#262926] border-slate-200 pb-3">
              <span className="text-xs font-semibold dark:text-zinc-400 text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#10b981]" />
                Stamp Visual Specification
              </span>
              <span className="text-[11px] font-mono dark:text-zinc-500 text-slate-400">A4 Pure Vector Stamp</span>
            </div>

            {/* Circular Stamp Visual Box (Transparent Authentic Paper Preview) */}
            <div className="flex flex-col items-center justify-center p-6 dark:bg-[#181a18] bg-white rounded-xl border dark:border-[#222422] border-slate-200 relative overflow-hidden shadow-inner">
              {/* Outer subtle emerald glow */}
              <div className="absolute w-48 h-48 rounded-full bg-[#10b981]/10 blur-2xl pointer-events-none" />

              {/* The Circular Stamp Component — Zero Background Box, Pure Green Seal */}
              <div className="relative w-56 h-56 rounded-full border-4 border-[#047857] dark:border-[#10b981] p-1 flex items-center justify-center bg-transparent drop-shadow-sm">
                {/* Secondary inner beaded ring */}
                <div className="w-full h-full rounded-full border border-dashed border-[#10b981] dark:border-[#34d399] p-1.5 flex items-center justify-center">
                  {/* Clean inner circular border */}
                  <div className="w-full h-full rounded-full border-2 border-[#047857] dark:border-[#10b981] flex flex-col items-center justify-center p-2 text-center relative overflow-hidden select-none bg-transparent">
                    {/* Faint diagonal TRUSTPAY watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rotate-[-25deg] opacity-15">
                      <span className="text-2xl font-black tracking-widest text-[#10b981] font-mono">TRUSTPAY</span>
                    </div>

                    {/* Header Branding */}
                    <span className="text-[9px] font-black tracking-wider text-[#047857] dark:text-[#10b981] uppercase font-mono z-10">
                      TRUSTPAY ENTERPRISE
                    </span>

                    {/* Approved Badge */}
                    <span className="text-[8px] font-black tracking-wider text-[#059669] dark:text-[#34d399] uppercase my-0.5 z-10 flex items-center gap-1">
                      ★ CLIENT APPROVED ★
                    </span>

                    <div className="w-24 h-[1px] bg-[#10b981]/50 my-1 z-10" />

                    {/* Authenticated Profile Name (Pure Green Ink) */}
                    <span className="text-[10px] font-bold text-[#047857] dark:text-[#10b981] uppercase max-w-[140px] truncate px-1 z-10">
                      {previewData?.profileName || 'VENKATA SUDHEER'}
                    </span>

                    {/* Verified Mobile Number (Pure Green Ink) */}
                    <span className="text-[8px] font-mono text-[#059669] dark:text-[#34d399] z-10 mt-0.5">
                      Mobile: {previewData?.verifiedMobile || '+91 9876543210'}
                    </span>

                    {/* Server Timestamp (Pure Green Ink) */}
                    <span className="text-[8px] font-bold text-[#047857] dark:text-[#10b981] font-mono z-10 mt-1">
                      Date: {previewData?.previewDate || '05 NOV 2026'}
                    </span>

                    <div className="w-24 h-[1px] bg-[#10b981]/50 my-1 z-10" />

                    {/* Bottom Label (Pure Green Ink) */}
                    <span className="text-[7px] font-extrabold tracking-widest text-[#047857] dark:text-[#10b981] uppercase font-mono z-10">
                      OFFICIAL DIGITAL SEAL
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] dark:text-zinc-400 text-slate-500 mt-4 text-center">
                High-resolution vector seal automatically rendered onto your approved contract PDF without background fill.
              </p>
            </div>

            {/* Profile Snapshot Credentials */}
            <div className="space-y-3 p-4 rounded-xl dark:bg-[#181a18] bg-slate-50 border dark:border-[#262926] border-slate-200 text-xs">
              <span className="dark:text-zinc-500 text-slate-400 uppercase font-semibold text-[10px] block">Authenticated Signer Dossier</span>

              <div className="flex items-center justify-between">
                <span className="dark:text-zinc-400 text-slate-500 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 dark:text-[#8BFF24] text-[#5046E5]" />
                  Client Name:
                </span>
                <span className="font-semibold dark:text-white text-slate-900">{previewData?.profileName || 'Authenticated User'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="dark:text-zinc-400 text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 dark:text-[#8BFF24] text-[#5046E5]" />
                  Verified Mobile:
                </span>
                {editingPhone ? (
                  <form onSubmit={handleSavePhone} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value)}
                      placeholder="+91..."
                      className="w-32 dark:bg-[#121412] bg-white border dark:border-[#2e322e] border-slate-300 rounded px-2 py-0.5 text-xs dark:text-white text-slate-900"
                    />
                    <button
                      type="submit"
                      disabled={savingPhone}
                      className="px-2 py-0.5 rounded dark:bg-[#8BFF24] bg-[#5046E5] dark:text-black text-white text-xs font-bold"
                    >
                      {savingPhone ? '...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="dark:text-zinc-400 text-slate-500 text-xs hover:opacity-80"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono dark:text-white text-slate-900 font-medium">
                      {previewData?.verifiedMobile || 'Not Provided'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(true)}
                      className="text-[10px] dark:text-[#8BFF24] text-[#5046E5] hover:underline font-semibold"
                    >
                      {previewData?.verifiedMobile ? 'Edit' : 'Add Mobile'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="dark:text-zinc-400 text-slate-500 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 dark:text-[#8BFF24] text-[#5046E5]" />
                  Server Timestamp:
                </span>
                <span className="font-mono dark:text-emerald-400 text-[#5046E5] font-semibold">{previewData?.previewDate || 'Live UTC'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Contract Stamping Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 p-6 rounded-2xl space-y-5 shadow-sm">
            <div>
              <h2 className="text-lg font-bold dark:text-white text-slate-900">Apply Stamp to Approved Contract</h2>
              <p className="text-xs dark:text-zinc-400 text-slate-500 mt-0.5">
                Select an approved agreement to embed your official seal in the reserved bottom empty space.
              </p>
            </div>

            {/* Contract Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold dark:text-zinc-300 text-slate-700 block">Select Target Contract</label>
              {eligibleContracts.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    No approved contracts available. Review and approve a contract in the Agreements tab to apply your official office stamp.
                  </span>
                </div>
              ) : (
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full dark:bg-[#181a18] bg-slate-50 border dark:border-[#2e322e] border-slate-300 rounded-xl px-4 py-2.5 text-xs dark:text-white text-slate-900 focus:outline-none dark:focus:border-[#8BFF24]/60 focus:border-[#5046E5]"
                >
                  {eligibleContracts.map((c) => (
                    <option key={c.id} value={c.id}>
                      Contract #{c.contractNumber} — {c.title} (v{c.version} • ${c.totalAmount.toLocaleString()} {c.currency})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Contract Info Card */}
            {selectedContract && (
              <div className="p-4 rounded-xl dark:bg-[#181a18] bg-slate-50 border dark:border-[#262926] border-slate-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono dark:text-zinc-400 text-slate-500 text-[11px]">{selectedContract.contractNumber}</span>
                    <h4 className="font-bold dark:text-white text-slate-900 text-sm mt-0.5">{selectedContract.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                      {selectedContract.status}
                    </span>
                    {selectedContractHasStamp && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] dark:border-[#8BFF24]/30 border-[#C7D2FE] flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Stamp Applied
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t dark:border-[#262926] border-slate-200 dark:text-zinc-400 text-slate-600">
                  <div>
                    <span className="dark:text-zinc-500 text-slate-400 text-[10px] block">Assigned Specialist</span>
                    <span className="dark:text-zinc-200 text-slate-800 font-medium">
                      {selectedContract.worker?.firstName
                        ? `${selectedContract.worker.firstName} ${selectedContract.worker.lastName || ''}`
                        : selectedContract.worker?.email}
                    </span>
                  </div>
                  <div>
                    <span className="dark:text-zinc-500 text-slate-400 text-[10px] block">Agreed Valuation</span>
                    <span className="dark:text-[#8BFF24] text-[#5046E5] font-mono font-bold">
                      ${selectedContract.totalAmount.toLocaleString()} {selectedContract.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Placement Interface */}
            <div className="space-y-2">
              <label className="text-xs font-semibold dark:text-zinc-300 text-slate-700 block">Stamp Placement in Reserved Space</label>
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'BOTTOM_RIGHT', label: 'Bottom Right (Recommended)', desc: 'Next to acceptance sign-offs' },
                  { id: 'BOTTOM_CENTER', label: 'Bottom Center', desc: 'Centered below acceptance' },
                  { id: 'BOTTOM_LEFT', label: 'Bottom Left', desc: 'Aligned with terms column' },
                ].map((pos) => (
                  <button
                    key={pos.id}
                    type="button"
                    onClick={() => setStampPosition(pos.id as any)}
                    className={`p-3 rounded-xl border text-left transition ${
                      stampPosition === pos.id
                        ? 'dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:border-[#8BFF24] border-[#5046E5] dark:text-white text-[#5046E5] dark:shadow-[0_0_12px_rgba(139,255,36,0.15)] shadow-sm'
                        : 'dark:bg-[#181a18] bg-slate-50 dark:border-[#262926] border-slate-200 dark:text-zinc-400 text-slate-600 hover:dark:text-white hover:text-slate-900'
                    }`}
                  >
                    <p className="text-xs font-bold">{pos.label}</p>
                    <p className="text-[10px] dark:text-zinc-500 text-slate-400 mt-0.5">{pos.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Official Contract Document Page Preview with Bottom Base Stamping */}
            <div className="p-4 sm:p-5 rounded-2xl dark:bg-[#0b0c0b] bg-slate-100 border dark:border-[#262926] border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold uppercase dark:text-[#8BFF24] text-[#5046E5] flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Official Contract Document Preview (Page Base Seal)
                </span>
                <span className="text-[10px] dark:text-zinc-400 text-slate-500 font-mono">Full A4 Base Placement</span>
              </div>

              {/* White Legal Document Canvas Sheet */}
              <div className="bg-white text-slate-900 border border-slate-300 rounded-xl shadow-2xl p-5 sm:p-6 font-sans relative overflow-hidden select-none space-y-4 min-h-[380px] flex flex-col justify-between">
                {/* Diagonal Legal Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] -rotate-12 select-none">
                  <span className="text-6xl font-black tracking-widest text-slate-900 font-mono uppercase">TRUSTPAY ESCROW LEGAL</span>
                </div>

                {/* Document Top Header */}
                <div className="border-b-2 border-slate-800 pb-3 flex items-start justify-between gap-3 relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-sm tracking-tight text-slate-900">TRUSTPAY ENTERPRISE</span>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded font-bold font-mono bg-emerald-100 text-emerald-800">
                        OFFICIAL AGREEMENT
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-600 font-medium mt-0.5">
                      DIGITAL SERVICE CONTRACT &amp; ESCROW COVENANT
                    </p>
                  </div>
                  <div className="text-right font-mono text-[10px] text-slate-600 space-y-0.5">
                    <p className="font-bold text-slate-900">REF: #{selectedContract?.contractNumber || 'TP-CNT-2026'}</p>
                    <p>VER: {selectedContract?.version || 1}.0 • {selectedContract?.currency || 'USD'}</p>
                  </div>
                </div>

                {/* Contract Summary Brief */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] space-y-1.5 text-slate-700 relative z-10">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                    <span className="font-semibold text-slate-900 truncate max-w-[280px]">
                      {selectedContract?.title || 'Enterprise Engineering Agreement'}
                    </span>
                    <span className="font-mono font-bold text-emerald-700 text-xs">
                      ${Number(selectedContract?.totalAmount || 5000).toLocaleString()} {selectedContract?.currency || 'USD'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
                    <div>
                      <span className="text-slate-500 block">Buyer / Client:</span>
                      <strong className="text-slate-900">{previewData?.profileName || 'Authorized Client'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Specialist / Provider:</span>
                      <strong className="text-slate-900">
                        {selectedContract?.worker?.firstName
                          ? `${selectedContract.worker.firstName} ${selectedContract.worker.lastName || ''}`
                          : 'Assigned Specialist'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Execution Affirmation Lines */}
                <div className="text-[10px] font-mono text-slate-600 space-y-1 pt-1 border-t border-slate-200 relative z-10">
                  <p className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                    <span>✓</span> CLIENT DIGITAL CONFIRMATION: {previewData?.profileName || 'Client Signer'} (VERIFIED)
                  </p>
                  <p className="flex items-center gap-1.5 text-slate-700">
                    <span>✓</span> SPECIALIST SIGN-OFF: ASSIGNED SPECIALIST (CRYPTOGRAPHIC DIGITAL CONFIRMATION)
                  </p>
                  <p className="text-[9px] text-slate-400 truncate">
                    SHA-256 DIGEST: {selectedContract?.documentHash?.slice(0, 36) || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'}...
                  </p>
                </div>

                {/* Base of Document: Reserved Space with Official Circular Stamp */}
                <div className="relative pt-4 pb-2 min-h-[140px] flex items-center justify-between border-t border-dashed border-slate-300">
                  <div className="text-[10px] text-slate-400 font-mono italic max-w-[180px] sm:max-w-[240px]">
                    Official TrustPay Circular Rubber Stamp applied directly to the document base in reserved margin space.
                  </div>

                  {/* Stamp placed according to position (Pure Green Ink, No Background Box, Authentic Seal) */}
                  <div
                    className={`${
                      stampPosition === 'BOTTOM_RIGHT'
                        ? 'ml-auto mr-1 sm:mr-3'
                        : stampPosition === 'BOTTOM_LEFT'
                        ? 'mr-auto ml-1 sm:ml-3'
                        : 'mx-auto'
                    } w-28 h-28 sm:w-32 sm:h-32 rounded-full border-2 border-[#047857] p-1.5 bg-transparent flex flex-col items-center justify-center text-center font-mono select-none shadow-sm -rotate-2 relative`}
                  >
                    {/* Inner Circular Ring */}
                    <div className="w-full h-full rounded-full border border-[#059669] border-dashed p-1 flex flex-col items-center justify-center relative">
                      <span className="font-extrabold text-[8px] sm:text-[9px] text-[#047857] tracking-wider uppercase">
                        TRUSTPAY
                      </span>
                      <span className="font-black text-[6.5px] sm:text-[7.5px] text-[#059669] tracking-tight uppercase my-0.5">
                        ★ CLIENT APPROVED ★
                      </span>
                      <span className="text-[7px] sm:text-[8px] text-[#047857] font-bold truncate max-w-[90px]">
                        {previewData?.profileName || 'AUTHENTICATED'}
                      </span>
                      {previewData?.verifiedMobile && (
                        <span className="text-[5.5px] sm:text-[6.5px] text-[#059669] font-medium truncate max-w-[95px]">
                          Mobile: {previewData.verifiedMobile}
                        </span>
                      )}
                      <span className="text-[6px] sm:text-[7px] text-[#059669] font-semibold mt-0.5">
                        {previewData?.previewDate || '05 NOV 2026'}
                      </span>
                      <span className="text-[5.5px] text-[#047857] tracking-widest uppercase opacity-85 mt-0.5">
                        OFFICIAL DIGITAL SEAL
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-[10px] dark:text-zinc-500 text-slate-400 italic">
                The stamp is embedded directly into the generated contract PDF at the base of the page, ensuring full legal validity on plain white paper without overlapping text.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t dark:border-[#262926] border-slate-200">
              {selectedContractHasStamp ? (
                <div className="flex items-center gap-2 text-xs dark:text-[#8BFF24] text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Official stamp already applied to active version.</span>
                </div>
              ) : (
                <div className="text-xs dark:text-zinc-400 text-slate-500">
                  Ready to apply authoritative Client stamp.
                </div>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedContract && (
                  <button
                    onClick={() => handleDownloadPdf(selectedContract.id, selectedContract.contractNumber)}
                    disabled={downloadingContractId === selectedContract.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl dark:bg-[#1e201e] bg-slate-100 hover:dark:bg-[#282c28] hover:bg-slate-200 border dark:border-[#2e322e] border-slate-200 dark:text-zinc-200 text-slate-700 text-xs font-semibold transition"
                  >
                    <Download className={`w-3.5 h-3.5 ${downloadingContractId === selectedContract.id ? 'animate-bounce' : ''}`} />
                    <span>{downloadingContractId === selectedContract.id ? 'Downloading...' : 'Download Contract PDF'}</span>
                  </button>
                )}

                <button
                  onClick={handleApplyStamp}
                  disabled={applying || eligibleContracts.length === 0 || selectedContractHasStamp}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl dark:bg-[#8BFF24] bg-[#5046E5] hover:dark:bg-[#78e018] hover:bg-[#4338CA] dark:text-black text-white text-xs font-bold transition dark:shadow-[0_0_15px_rgba(139,255,36,0.25)] shadow-md shadow-[#5046E5]/25 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Stamp className={`w-4 h-4 ${applying ? 'animate-spin' : ''}`} />
                  <span>{applying ? 'Applying Official Stamp...' : selectedContractHasStamp ? 'Stamp Applied' : 'Apply Official Stamp'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Stamp History Table */}
      <div className="interactive-card dark:bg-[#121412] bg-white border dark:border-[#262926] border-slate-200 p-6 rounded-2xl space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold dark:text-white text-slate-900">Client Stamp Application Audit Log</h3>
            <p className="text-xs dark:text-zinc-400 text-slate-500">
              Immutable historical records of official office stamps applied to approved contract PDFs.
            </p>
          </div>
          <span className="text-xs font-mono dark:text-zinc-500 text-slate-400">{stampHistory.length} Recorded Stamps</span>
        </div>

        {stampHistory.length === 0 ? (
          <div className="p-8 text-center dark:bg-[#181a18] bg-slate-50 rounded-xl border dark:border-[#262926] border-slate-200">
            <Stamp className="w-8 h-8 dark:text-zinc-600 text-slate-400 mx-auto mb-2" />
            <p className="text-xs dark:text-zinc-400 text-slate-600">No contracts have been stamped yet.</p>
            <p className="text-[11px] dark:text-zinc-500 text-slate-400 mt-0.5">
              Select an approved contract above and click "Apply Official Stamp" to generate your first verified office seal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border dark:border-[#262926] border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="dark:bg-[#181a18] bg-slate-50 dark:text-zinc-400 text-slate-600 uppercase font-semibold border-b dark:border-[#262926] border-slate-200">
                <tr>
                  <th className="py-3 px-4">Contract #</th>
                  <th className="py-3 px-4">Agreement Title</th>
                  <th className="py-3 px-4">Applied Date &amp; Time</th>
                  <th className="py-3 px-4">Signer Mobile Snapshot</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-[#262926] divide-slate-200 dark:text-zinc-300 text-slate-700">
                {stampHistory.map((stamp) => (
                  <tr key={stamp.id} className="dark:hover:bg-[#161816] hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-mono font-bold dark:text-white text-slate-900">
                      {stamp.contract?.contractNumber || 'CNT-#'}
                    </td>
                    <td className="py-3 px-4 font-medium dark:text-zinc-200 text-slate-800 max-w-xs truncate">
                      {stamp.contract?.title || 'Contract Agreement'}
                    </td>
                    <td className="py-3 px-4 dark:text-zinc-400 text-slate-500 font-mono text-[11px]">
                      {new Date(stamp.appliedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono dark:text-zinc-300 text-slate-600 text-[11px]">
                      {stamp.verifiedMobileSnapshot}
                    </td>
                    <td className="py-3 px-4 font-mono">v{stamp.pdfVersion}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold dark:bg-[#8BFF24]/10 bg-[#EEF2FF] dark:text-[#8BFF24] text-[#5046E5] dark:border-[#8BFF24]/30 border-[#C7D2FE]">
                        {stamp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadPdf(stamp.contractId, stamp.contract?.contractNumber || 'contract')}
                        disabled={downloadingContractId === stamp.contractId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg dark:bg-[#8BFF24]/10 bg-[#EEF2FF] hover:dark:bg-[#8BFF24]/20 hover:bg-[#E0E7FF] dark:border-[#8BFF24]/30 border-[#C7D2FE] dark:text-[#8BFF24] text-[#5046E5] text-[11px] font-bold transition cursor-pointer"
                      >
                        <Download className="w-3 h-3" />
                        <span>PDF</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

