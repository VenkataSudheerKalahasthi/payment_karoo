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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#121412] dark:bg-[#121412] border border-[#262926] p-6 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8BFF24]/10 border border-[#8BFF24]/30 flex items-center justify-center">
            <Stamp className="w-5 h-5 text-[#8BFF24]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Client Digital Office Stamp</h1>
              <span className="text-[10px] uppercase font-bold font-mono px-2 py-0.5 rounded-full bg-[#8BFF24]/10 text-[#8BFF24] border border-[#8BFF24]/30">
                Official Seal
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-0.5">
              Apply your official TrustPay circular office stamp to approved digital contracts for verifiable authority.
            </p>
          </div>
        </div>

        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e201e] border border-[#2e322e] text-zinc-300 hover:text-white hover:border-[#8BFF24]/40 transition text-sm font-medium"
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
          <div className="bg-[#121412] border border-[#262926] p-6 rounded-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-[#262926] pb-3">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-[#8BFF24]" />
                Stamp Visual Specification
              </span>
              <span className="text-[11px] font-mono text-zinc-500">A4 Scaled Vector</span>
            </div>

            {/* Circular Stamp Visual Box */}
            <div className="flex flex-col items-center justify-center p-6 bg-[#0a0b0a] rounded-xl border border-[#222422] relative overflow-hidden">
              {/* Outer decorative glow */}
              <div className="absolute w-48 h-48 rounded-full bg-[#8BFF24]/5 blur-2xl pointer-events-none" />

              {/* The Circular Stamp Component */}
              <div className="relative w-56 h-56 rounded-full border-4 border-[#047857] p-1 shadow-[0_0_25px_rgba(4,120,87,0.25)] flex items-center justify-center bg-[#0d120d]">
                {/* Secondary inner beaded ring */}
                <div className="w-full h-full rounded-full border border-dashed border-[#10b981] p-1.5 flex items-center justify-center">
                  {/* Clean inner circular border */}
                  <div className="w-full h-full rounded-full border-2 border-[#047857] flex flex-col items-center justify-center p-2 text-center relative overflow-hidden select-none">
                    {/* Faint diagonal TRUSTPAY watermark */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none rotate-[-25deg] opacity-15">
                      <span className="text-2xl font-black tracking-widest text-[#10b981] font-mono">TRUSTPAY</span>
                    </div>

                    {/* Header Branding */}
                    <span className="text-[9px] font-black tracking-wider text-[#047857] uppercase font-mono z-10">
                      TRUSTPAY ENTERPRISE
                    </span>

                    {/* Approved Badge */}
                    <span className="text-[8px] font-black tracking-wider text-[#10b981] uppercase my-0.5 z-10 flex items-center gap-1">
                      ★ CLIENT APPROVED ★
                    </span>

                    <div className="w-24 h-[1px] bg-[#10b981]/50 my-1 z-10" />

                    {/* Authenticated Profile Name */}
                    <span className="text-[10px] font-bold text-white uppercase max-w-[140px] truncate px-1 z-10">
                      {previewData?.profileName || 'VENKATA SUDHEER'}
                    </span>

                    {/* Verified Mobile Number */}
                    <span className="text-[8px] font-mono text-zinc-300 z-10 mt-0.5">
                      Mobile: {previewData?.verifiedMobile || '+91 9876543210'}
                    </span>

                    {/* Server Timestamp */}
                    <span className="text-[8px] font-bold text-[#10b981] font-mono z-10 mt-1">
                      Date: {previewData?.previewDate || '05 NOV 2026'}
                    </span>

                    <div className="w-24 h-[1px] bg-[#10b981]/50 my-1 z-10" />

                    {/* Bottom Label */}
                    <span className="text-[7px] font-extrabold tracking-widest text-[#047857] uppercase font-mono z-10">
                      OFFICIAL DIGITAL SEAL
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-zinc-400 mt-4 text-center">
                High-resolution vector seal automatically rendered onto your approved contract PDF.
              </p>
            </div>

            {/* Profile Snapshot Credentials */}
            <div className="space-y-3 p-4 rounded-xl bg-[#181a18] border border-[#262926] text-xs">
              <span className="text-zinc-500 uppercase font-semibold text-[10px] block">Authenticated Signer Dossier</span>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#8BFF24]" />
                  Client Name:
                </span>
                <span className="font-semibold text-white">{previewData?.profileName || 'Authenticated User'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#8BFF24]" />
                  Verified Mobile:
                </span>
                {editingPhone ? (
                  <form onSubmit={handleSavePhone} className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={phoneNumberInput}
                      onChange={(e) => setPhoneNumberInput(e.target.value)}
                      placeholder="+91..."
                      className="w-32 bg-[#121412] border border-[#2e322e] rounded px-2 py-0.5 text-xs text-white"
                    />
                    <button
                      type="submit"
                      disabled={savingPhone}
                      className="px-2 py-0.5 rounded bg-[#8BFF24] text-black text-xs font-bold"
                    >
                      {savingPhone ? '...' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(false)}
                      className="text-zinc-400 text-xs hover:text-white"
                    >
                      ✕
                    </button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-white font-medium">
                      {previewData?.verifiedMobile || 'Not Provided'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingPhone(true)}
                      className="text-[10px] text-[#8BFF24] hover:underline font-semibold"
                    >
                      {previewData?.verifiedMobile ? 'Edit' : 'Add Mobile'}
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#8BFF24]" />
                  Server Timestamp:
                </span>
                <span className="font-mono text-emerald-400 font-semibold">{previewData?.previewDate || 'Live UTC'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Contract Stamping Studio (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#121412] border border-[#262926] p-6 rounded-2xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white">Apply Stamp to Approved Contract</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Select an approved agreement to embed your official seal in the reserved bottom empty space.
              </p>
            </div>

            {/* Contract Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">Select Target Contract</label>
              {eligibleContracts.length === 0 ? (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>
                    No approved contracts available. Review and approve a contract in the Agreements tab to apply your official office stamp.
                  </span>
                </div>
              ) : (
                <select
                  value={selectedContractId}
                  onChange={(e) => setSelectedContractId(e.target.value)}
                  className="w-full bg-[#181a18] border border-[#2e322e] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-[#8BFF24]/60"
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
              <div className="p-4 rounded-xl bg-[#181a18] border border-[#262926] space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-zinc-400 text-[11px]">{selectedContract.contractNumber}</span>
                    <h4 className="font-bold text-white text-sm mt-0.5">{selectedContract.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      {selectedContract.status}
                    </span>
                    {selectedContractHasStamp && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#8BFF24]/10 text-[#8BFF24] border border-[#8BFF24]/30 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Stamp Applied
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#262926] text-zinc-400">
                  <div>
                    <span className="text-zinc-500 text-[10px] block">Assigned Specialist</span>
                    <span className="text-zinc-200 font-medium">
                      {selectedContract.worker?.firstName
                        ? `${selectedContract.worker.firstName} ${selectedContract.worker.lastName || ''}`
                        : selectedContract.worker?.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 text-[10px] block">Agreed Valuation</span>
                    <span className="text-[#8BFF24] font-mono font-bold">
                      ${selectedContract.totalAmount.toLocaleString()} {selectedContract.currency}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Placement Interface */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">Stamp Placement in Reserved Space</label>
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
                        ? 'bg-[#8BFF24]/10 border-[#8BFF24] text-white shadow-[0_0_12px_rgba(139,255,36,0.15)]'
                        : 'bg-[#181a18] border-[#262926] text-zinc-400 hover:text-white'
                    }`}
                  >
                    <p className="text-xs font-bold">{pos.label}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{pos.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Contract PDF Footer Preview */}
            <div className="p-4 rounded-xl bg-[#0b0c0b] border border-[#262926] space-y-3">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block">Document Reserved Area Preview</span>
              <div className="bg-[#141614] border border-[#2e322e] rounded-lg p-4 relative min-h-[110px] flex items-center">
                <div className="text-[11px] text-zinc-500 font-mono space-y-1">
                  <p>✓ CLIENT (BUYER): {previewData?.profileName || 'Verified Client'} — Method: DIGITAL_CONFIRMATION</p>
                  <p>✓ WORKER (SERVICE PROVIDER): Assigned Specialist — Method: DIGITAL_CONFIRMATION</p>
                  <p className="text-[9px] text-zinc-600">SHA-256 Digest: {selectedContract?.documentHash?.slice(0, 32) || 'a8f3...'}...</p>
                </div>

                {/* Stamp placed according to position */}
                <div
                  className={`absolute ${
                    stampPosition === 'BOTTOM_RIGHT'
                      ? 'right-4'
                      : stampPosition === 'BOTTOM_LEFT'
                      ? 'left-4'
                      : 'left-1/2 -translate-x-1/2'
                  } w-20 h-20 rounded-full border-2 border-[#10b981] bg-[#0d120d]/90 flex flex-col items-center justify-center text-[7px] text-[#10b981] font-mono p-1 shadow-md`}
                >
                  <span className="font-bold text-[6px]">TRUSTPAY</span>
                  <span className="font-extrabold text-[5px] text-white">CLIENT APPROVED</span>
                  <span className="text-[5px] text-zinc-300 truncate max-w-[65px]">{previewData?.profileName}</span>
                  <span className="text-[5px] text-[#8BFF24]">{previewData?.previewDate}</span>
                </div>
              </div>
              <p className="text-[10px] text-zinc-500 italic">
                The stamp is embedded directly into the generated PDF without overlapping contract text or terms.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#262926]">
              {selectedContractHasStamp ? (
                <div className="flex items-center gap-2 text-xs text-[#8BFF24]">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Official stamp already applied to active version.</span>
                </div>
              ) : (
                <div className="text-xs text-zinc-400">
                  Ready to apply authoritative Client stamp.
                </div>
              )}

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {selectedContract && (
                  <button
                    onClick={() => handleDownloadPdf(selectedContract.id, selectedContract.contractNumber)}
                    disabled={downloadingContractId === selectedContract.id}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1e201e] hover:bg-[#282c28] border border-[#2e322e] text-zinc-200 text-xs font-semibold transition"
                  >
                    <Download className={`w-3.5 h-3.5 ${downloadingContractId === selectedContract.id ? 'animate-bounce' : ''}`} />
                    <span>{downloadingContractId === selectedContract.id ? 'Downloading...' : 'Download Contract PDF'}</span>
                  </button>
                )}

                <button
                  onClick={handleApplyStamp}
                  disabled={applying || eligibleContracts.length === 0 || selectedContractHasStamp}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#8BFF24] hover:bg-[#78e018] text-black text-xs font-bold transition shadow-[0_0_15px_rgba(139,255,36,0.25)] disabled:opacity-40 disabled:cursor-not-allowed"
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
      <div className="bg-[#121412] border border-[#262926] p-6 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">Client Stamp Application Audit Log</h3>
            <p className="text-xs text-zinc-400">
              Immutable historical records of official office stamps applied to approved contract PDFs.
            </p>
          </div>
          <span className="text-xs font-mono text-zinc-500">{stampHistory.length} Recorded Stamps</span>
        </div>

        {stampHistory.length === 0 ? (
          <div className="p-8 text-center bg-[#181a18] rounded-xl border border-[#262926]">
            <Stamp className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
            <p className="text-xs text-zinc-400">No contracts have been stamped yet.</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Select an approved contract above and click "Apply Official Stamp" to generate your first verified office seal.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#262926]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#181a18] text-zinc-400 uppercase font-semibold border-b border-[#262926]">
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
              <tbody className="divide-y divide-[#262926] text-zinc-300">
                {stampHistory.map((stamp) => (
                  <tr key={stamp.id} className="hover:bg-[#161816] transition">
                    <td className="py-3 px-4 font-mono font-bold text-white">
                      {stamp.contract?.contractNumber || 'CNT-#'}
                    </td>
                    <td className="py-3 px-4 font-medium text-zinc-200 max-w-xs truncate">
                      {stamp.contract?.title || 'Contract Agreement'}
                    </td>
                    <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                      {new Date(stamp.appliedAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-300 text-[11px]">
                      {stamp.verifiedMobileSnapshot}
                    </td>
                    <td className="py-3 px-4 font-mono">v{stamp.pdfVersion}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#8BFF24]/10 text-[#8BFF24] border border-[#8BFF24]/30">
                        {stamp.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDownloadPdf(stamp.contractId, stamp.contract?.contractNumber || 'contract')}
                        disabled={downloadingContractId === stamp.contractId}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#8BFF24]/10 hover:bg-[#8BFF24]/20 border border-[#8BFF24]/30 text-[#8BFF24] text-[11px] font-bold transition"
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

