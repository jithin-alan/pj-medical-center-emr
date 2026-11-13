import React, { useState, useMemo } from 'react';
import { useClinic } from '../context/ClinicContext';
import { TokenVisit, PrescribedProcedure } from '../types';
import {
  Syringe,
  CheckCircle2,
  XCircle,
  FileCheck,
  Clock,
  User,
  AlertCircle,
  Search,
  History,
  AlertTriangle,
  FileText,
  Calendar
} from 'lucide-react';
import { PatientJourneyBar } from '../components/PatientJourneyBar';

const findProcedureBillItem = (items: { name: string; qty: number }[], procedureName: string) =>
  items.find((item) => item.name.replace(/^\[(Procedure|Lab)\]\s*/, '').trim() === procedureName.trim());

export const NurseScreen: React.FC = () => {
  const {
    visits,
    patients,
    doctors,
    bills,
    currentUser,
    markProcedureGiven,
    markProcedureNotGiven,
    showToast,
  } = useClinic();

  // Memoized lookup maps for efficient O(1) access
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const [activeTab, setActiveTab] = useState<'active_queue' | 'fulfilled_history'>('active_queue');

  // Active nurse queue: visits that have procedure orders with pending administration or stage nurse_check_pending
  const nurseQueue = useMemo(() => {
    return visits.filter(
      (v) =>
        v.status === 'nurse_check_pending' ||
        (v.procedureOrders.length > 0 && v.procedureOrders.some((p) => p.billed && p.status !== 'GIVEN' && !p.nurseGiven && !p.nurseNote?.includes('NOT GIVEN')))
    );
  }, [visits]);

  const [selectedVisitId, setSelectedVisitId] = useState<string>(nurseQueue[0]?.id || '');
  const [notesInput, setNotesInput] = useState<{ [procedureId: string]: string }>({});

  // Not Given in-page modal
  const [notGivenModalOpen, setNotGivenModalOpen] = useState(false);
  const [targetProcedureForNotGiven, setTargetProcedureForNotGiven] = useState<PrescribedProcedure | null>(null);
  const [notGivenReason, setNotGivenReason] = useState('');

  // Fulfilled history search
  const [historySearch, setHistorySearch] = useState('');

  const activeVisit = visits.find((v) => v.id === selectedVisitId) || nurseQueue[0];
  const activePatient = activeVisit ? patientMap.get(activeVisit.patientId) : undefined;
  const activeDoctor = activeVisit ? doctorMap.get(activeVisit.doctorId) : undefined;

  // Find the procedure bill for the active visit
  const procedureBill = useMemo(() => {
    if (!activeVisit) return null;
    return bills.find(
      (b) => b.type === 'procedure' && (b.visitId === activeVisit.id || b.invoiceNo === activeVisit.procedureBillId)
    );
  }, [bills, activeVisit]);

  // Handle Mark Given
  const handleGiveProcedure = async (proc: PrescribedProcedure) => {
    if (!activeVisit) return;

    // Client-side pre-validation using single status
    const isBilled = proc.status === 'BILLED' || proc.billed;
    const isGiven = proc.status === 'GIVEN' || proc.nurseGiven;

    if (isGiven) {
      showToast('info', `"${proc.name}" has already been administered.`);
      return;
    }

    if (!isBilled) {
      showToast('error', `Cannot administer "${proc.name}": Item status is UNBILLED. Reception billing is required before administration.`, 'Billing Required');
      return;
    }

    // Check mismatch
    if (procedureBill) {
      const billedItem = findProcedureBillItem(procedureBill.items, proc.name);
      if (!billedItem) {
        showToast('error', `Invoice mismatch: "${proc.name}" does not appear on Reception Invoice #${procedureBill.invoiceNo}!`, 'Order Mismatch');
        return;
      }
      if (billedItem.qty < proc.qty) {
        showToast('error', `Quantity mismatch: Doctor ordered ${proc.qty}, but only ${billedItem.qty} was paid for!`, 'Quantity Mismatch');
        return;
      }
    } else {
      showToast('error', 'Cannot administer: No paid procedure invoice found on record for this visit.', 'Missing Invoice');
      return;
    }

    const note = notesInput[proc.procedureId] || '';
    const success = await markProcedureGiven(activeVisit.id, proc.procedureId, note);
    if (success) {
      setNotesInput((prev) => ({ ...prev, [proc.procedureId]: '' }));
    }
  };

  const handleConfirmNotGiven = async () => {
    if (!activeVisit || !targetProcedureForNotGiven) return;
    if (!notGivenReason.trim()) {
      showToast('warning', 'Please provide a clinical or patient reason why this procedure was not administered.');
      return;
    }

    const success = await markProcedureNotGiven(activeVisit.id, targetProcedureForNotGiven.procedureId, notGivenReason);
    if (success) {
      setNotGivenModalOpen(false);
      setTargetProcedureForNotGiven(null);
      setNotGivenReason('');
    }
  };

  // Compile Fulfilled History (grouped by patient & visit date)
  const fulfilledGroups = useMemo(() => {
    const list: {
      visitId: string;
      patient: typeof patients[0];
      visitDate: string;
      doctorName: string;
      items: {
        procedureName: string;
        qty: number;
        nurseName: string;
        nurseGivenAt: string;
        nurseNote: string;
        invoiceNo?: string;
      }[];
    }[] = [];

    visits.forEach((v) => {
      const pat = patientMap.get(v.patientId);
      if (!pat) return;

      const givenProcs = v.procedureOrders.filter((p) => p.nurseGiven);
      if (givenProcs.length === 0) return;

      const doc = doctorMap.get(v.doctorId);

      list.push({
        visitId: v.id,
        patient: pat,
        visitDate: v.timestamp,
        doctorName: doc ? doc.name : 'Attending Physician',
        items: givenProcs.map((p) => ({
          procedureName: p.name,
          qty: p.qty,
          nurseName: p.nurseName || 'Nursing Staff',
          nurseGivenAt: p.nurseGivenAt || v.timestamp,
          nurseNote: p.nurseNote || '',
          invoiceNo: p.billInvoiceNo || v.procedureBillId,
        })),
      });
    });

    // Sort newest first
    list.sort((a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime());

    // Filter by search query (MRN, Name, Phone)
    if (!historySearch.trim()) return list;
    const q = historySearch.toLowerCase().trim();
    return list.filter(
      (g) =>
        g.patient.mrn.toLowerCase().includes(q) ||
        g.patient.phone.toLowerCase().includes(q) ||
        g.patient.name.toLowerCase().includes(q)
    );
  }, [visits, patients, doctors, historySearch]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <Syringe className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Nursing & Procedure Station
            </h2>
            <p className="text-xs text-slate-500">
              Active Nurse: <strong className="text-slate-700">{currentUser.name}</strong> · Injection & Minor Procedure Room
            </p>
          </div>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setActiveTab('active_queue')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors relative flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'active_queue'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Syringe className="w-3.5 h-3.5 text-teal-600" />
              <span>Active Orders</span>
              {nurseQueue.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                  {nurseQueue.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('fulfilled_history')}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'fulfilled_history'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5 text-slate-500" />
              <span>Fulfilled History</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: ACTIVE NURSE QUEUE & ONE CARD PER ORDER */}
      {activeTab === 'active_queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Waiting Queue */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Patients for Procedures ({nurseQueue.length})
              </h3>
              <span className="text-xs text-slate-400 font-mono">Live</span>
            </div>

            {nurseQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                No patients waiting for nursing procedures or injections.
              </div>
            ) : (
              <div className="space-y-2.5">
                {nurseQueue.map((v) => {
                  const pat = patients.find((p) => p.id === v.patientId);
                  const unexecutedCount = v.procedureOrders.filter((p) => !p.nurseGiven && !p.nurseNote?.includes('NOT GIVEN')).length;
                  const isAllBilled = v.procedureOrders.every((p) => p.billed);

                  return (
                    <div
                      key={v.id}
                      onClick={() => setSelectedVisitId(v.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        activeVisit?.id === v.id
                          ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-base text-slate-900">
                          {v.tokenNumber}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            isAllBilled
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isAllBilled ? 'BILLED' : 'UNBILLED'}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-800 mt-1">
                        {pat?.name} ({pat?.age}y, {pat?.sex[0]})
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {unexecutedCount} order item(s) pending administration
                      </div>
                      {pat?.allergies && pat.allergies.length > 0 && (
                        <div className="text-[10px] text-rose-600 font-bold mt-1">
                          ⚠️ Allergies: {pat.allergies.join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Procedure Administration - One Card Per Order */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6">
            {activeVisit && activePatient ? (
              <>
                {/* Patient Banner */}
                <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-teal-500/20 border border-teal-500/40 rounded-lg text-center">
                      <span className="text-[10px] uppercase font-bold text-teal-300 block">TOKEN</span>
                      <span className="text-2xl font-black font-mono text-white">
                        {activeVisit.tokenNumber}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>{activePatient.name}</span>
                        <span className="text-xs font-mono text-slate-400">({activePatient.mrn})</span>
                      </h3>
                      <p className="text-xs text-slate-300">
                        Doctor: {activeDoctor?.name} · Age: {activePatient.age}y ({activePatient.sex}) · Ph: {activePatient.phone}
                      </p>
                    </div>
                  </div>

                  {activePatient.allergies.length > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] uppercase text-rose-300 font-bold block">Patient Allergies</span>
                      <span className="text-xs font-bold text-white bg-rose-600 px-2.5 py-1 rounded-md inline-block">
                        ⚠️ {activePatient.allergies.join(', ')}
                      </span>
                    </div>
                  )}
                </div>

                {/* Patient Stage Journey */}
                <PatientJourneyBar visit={activeVisit} />

                {/* Procedure Orders: ONE CARD PER ORDER */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Doctor's Procedure Orders ({activeVisit.procedureOrders.length})
                      </h4>
                      <p className="text-xs text-slate-500">
                        Each card represents one prescribed order item. Unbilled items must be paid at reception before administering.
                      </p>
                    </div>
                    {procedureBill && (
                      <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        Paid Invoice: #{procedureBill.invoiceNo}
                      </span>
                    )}
                  </div>

                  {activeVisit.procedureOrders.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-slate-200">
                      No procedure orders prescribed for this patient.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeVisit.procedureOrders.map((proc) => {
                        const isGiven = proc.status === 'GIVEN' || proc.nurseGiven;
                        const isNotGiven = !isGiven && proc.nurseNote?.includes('NOT GIVEN');
                        const isBilled = proc.status === 'BILLED' || (!isGiven && proc.billed);

                        // Check mismatch against procedure bill
                        const billedItem = procedureBill ? findProcedureBillItem(procedureBill.items, proc.name) : undefined;
                        const hasItemMismatch = isBilled && procedureBill && !billedItem;
                        const hasQtyMismatch = isBilled && billedItem && billedItem.qty < proc.qty;

                        return (
                          <div
                            key={proc.procedureId}
                            className={`p-4 rounded-xl border transition-all ${
                              isGiven
                                ? 'bg-emerald-50/40 border-emerald-200'
                                : isNotGiven
                                ? 'bg-rose-50/40 border-rose-200'
                                : isBilled
                                ? 'bg-white border-slate-200 shadow-xs hover:border-teal-300'
                                : 'bg-amber-50/30 border-amber-200'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                              {/* Order Information */}
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-bold text-base text-slate-900">
                                    {proc.name}
                                  </span>

                                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200">
                                    Qty: {proc.qty}
                                  </span>

                                  {/* Authoritative Single Status: UNBILLED -> BILLED -> GIVEN */}
                                  {isGiven ? (
                                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                      <span>GIVEN</span>
                                      {proc.billInvoiceNo && <span className="text-[10px] font-mono">({proc.billInvoiceNo})</span>}
                                    </span>
                                  ) : isBilled ? (
                                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>BILLED</span>
                                      {proc.billInvoiceNo && <span className="text-[10px] font-mono">({proc.billInvoiceNo})</span>}
                                    </span>
                                  ) : (
                                    <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                      <span>UNBILLED</span>
                                    </span>
                                  )}
                                </div>

                                {/* Doctor Notes */}
                                {proc.notes ? (
                                  <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
                                    <span className="font-bold text-slate-900">Doctor Instructions: </span>
                                    <span className="italic">{proc.notes}</span>
                                  </div>
                                ) : (
                                  <div className="text-xs text-slate-400 italic">
                                    No specific doctor notes for this item.
                                  </div>
                                )}

                                {/* Mismatch Warning Banner */}
                                {(hasItemMismatch || hasQtyMismatch) && (
                                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-semibold flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>
                                      {hasItemMismatch
                                        ? `MISMATCH: "${proc.name}" does not match billed invoice #${procedureBill?.invoiceNo}. Administration blocked.`
                                        : `QUANTITY MISMATCH: Prescribed ${proc.qty}, but invoice only covers ${billedItem?.qty}. Reception correction required.`}
                                    </span>
                                  </div>
                                )}

                                {/* Unbilled notice */}
                                {!isBilled && !isGiven && (
                                  <div className="text-xs text-amber-700 flex items-center gap-1 pt-0.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Patient must settle procedure charges at the reception counter prior to administration.</span>
                                  </div>
                                )}

                                {/* Administered log */}
                                {isGiven && (
                                  <div className="text-xs text-emerald-800 font-medium flex items-center gap-1.5 pt-1">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                    <span>
                                      Administered at{' '}
                                      {new Date(proc.nurseGivenAt || '').toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}{' '}
                                      by <strong>{proc.nurseName}</strong>
                                    </span>
                                    {proc.nurseNote && (
                                      <span className="text-slate-600">({proc.nurseNote})</span>
                                    )}
                                  </div>
                                )}

                                {/* Not Given reason */}
                                {isNotGiven && (
                                  <div className="text-xs text-rose-700 font-medium flex items-center gap-1.5 pt-1">
                                    <XCircle className="w-4 h-4 text-rose-600" />
                                    <span>{proc.nurseNote}</span>
                                    <span className="text-slate-400">· by {proc.nurseName}</span>
                                  </div>
                                )}
                              </div>

                              {/* Card Action Controls */}
                              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 pt-2 sm:pt-0">
                                {!isGiven && !isNotGiven && (
                                  <>
                                    <input
                                      type="text"
                                      placeholder="Optional nurse note..."
                                      value={notesInput[proc.procedureId] || ''}
                                      onChange={(e) =>
                                        setNotesInput({
                                          ...notesInput,
                                          [proc.procedureId]: e.target.value,
                                        })
                                      }
                                      className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg w-full sm:w-44 focus:outline-hidden focus:border-teal-500 bg-white"
                                    />

                                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTargetProcedureForNotGiven(proc);
                                          setNotGivenReason('');
                                          setNotGivenModalOpen(true);
                                        }}
                                        className="flex-1 sm:flex-none px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                                      >
                                        Not Given
                                      </button>

                                      <button
                                        type="button"
                                        disabled={!isBilled || hasItemMismatch || Boolean(hasQtyMismatch)}
                                        onClick={() => handleGiveProcedure(proc)}
                                        className="flex-1 sm:flex-none px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                        title={
                                          !isBilled
                                            ? 'Blocked: Item is UNBILLED'
                                            : hasItemMismatch || hasQtyMismatch
                                            ? 'Blocked: Invoice mismatch'
                                            : 'Click to confirm administration'
                                        }
                                      >
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Mark Given</span>
                                      </button>
                                    </div>
                                  </>
                                )}

                                {isGiven && (
                                  <span className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 rounded-lg flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Administered</span>
                                  </span>
                                )}

                                {isNotGiven && (
                                  <span className="px-3 py-1.5 text-xs font-bold text-rose-800 bg-rose-100/80 border border-rose-300 rounded-lg flex items-center gap-1.5">
                                    <XCircle className="w-3.5 h-3.5" />
                                    <span>Withheld</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-slate-400 italic">
                Select a patient from the queue to view procedure order cards.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: FULFILLED HISTORY (Grouped by Patient and Date, Searchable by MRN or Mobile) */}
      {activeTab === 'fulfilled_history' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-slate-900 uppercase">
                  Fulfilled Procedures History
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Archived log of all administered procedures and injections grouped by patient and visit date.
              </p>
            </div>

            {/* Search Box: auto-search MRN or Phone */}
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by MRN (PJ-000001), phone, or name..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden focus:border-teal-500"
              />
            </div>
          </div>

          {fulfilledGroups.length === 0 ? (
            <div className="py-16 text-center text-xs text-slate-400 italic">
              {historySearch
                ? `No fulfilled procedures found matching "${historySearch}".`
                : 'No procedure orders have been fulfilled yet today.'}
            </div>
          ) : (
            <div className="space-y-4">
              {fulfilledGroups.map((group) => {
                const dateFormatted = new Date(group.visitDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                });
                const timeFormatted = new Date(group.visitDate).toLocaleTimeString('en-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={group.visitId}
                    className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs"
                  >
                    {/* Patient & Visit Header */}
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="font-mono font-bold text-xs bg-slate-900 text-white px-2 py-0.5 rounded">
                          {group.patient.mrn}
                        </div>
                        <div className="font-bold text-sm text-slate-900">
                          {group.patient.name}
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {group.patient.phone} · {group.patient.age}y ({group.patient.sex})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Attending: <strong>{group.doctorName}</strong></span>
                        <span>·</span>
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {dateFormatted} {timeFormatted}
                        </span>
                      </div>
                    </div>

                    {/* Table of items fulfilled in this visit */}
                    <div className="p-4 space-y-2">
                      {group.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-teal-50/30 border border-teal-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{item.procedureName}</span>
                              <span className="font-mono px-2 py-0.2 rounded bg-white border border-teal-200 text-teal-800 font-semibold">
                                Qty: {item.qty}
                              </span>
                              {item.invoiceNo && (
                                <span className="font-mono text-[10px] text-slate-500">
                                  Inv: #{item.invoiceNo}
                                </span>
                              )}
                            </div>
                            {item.nurseNote && (
                              <div className="text-[11px] text-slate-600 italic">
                                Note: {item.nurseNote}
                              </div>
                            )}
                          </div>

                          <div className="text-right text-[11px] text-slate-500">
                            <div>
                              Given by: <strong className="text-slate-800">{item.nurseName}</strong>
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">
                              {new Date(item.nurseGivenAt).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* NOT GIVEN IN-PAGE MODAL */}
      {notGivenModalOpen && targetProcedureForNotGiven && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 pb-2 border-b border-slate-100">
              <AlertCircle className="w-5 h-5" />
              <h3 className="font-bold text-slate-900 text-sm">
                Record Item Not Administered
              </h3>
            </div>

            <p className="text-xs text-slate-600">
              Item: <strong>{targetProcedureForNotGiven.name}</strong> (Qty: {targetProcedureForNotGiven.qty})
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason Not Administered *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Patient refused injection, adverse symptom observed, doctor verbally cancelled..."
                value={notGivenReason}
                onChange={(e) => setNotGivenReason(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNotGivenModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmNotGiven}
                className="px-3.5 py-1.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer"
              >
                Save Withheld Reason
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
