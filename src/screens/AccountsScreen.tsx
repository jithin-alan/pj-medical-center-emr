import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import { Bill, ShiftRecord, ShiftType } from '../types';
import {
  Calculator,
  Download,
  Printer,
  Ban,
  Clock,
  ArrowUpRight,
  TrendingUp,
  FileSpreadsheet,
  AlertOctagon,
  CheckCircle2,
  DollarSign,
  UserCheck,
  AlertCircle
} from 'lucide-react';

export const AccountsScreen: React.FC = () => {
  const {
    bills,
    shifts,
    doctors,
    visits,
    currentUser,
    openShift,
    closeShift,
    voidBill,
    showToast,
    showConfirm,
  } = useClinic();

  // Active view: 'overview_eod' | 'shifts_cash' | 'bills_voids'
  const [activeTab, setActiveTab] = useState<'overview_eod' | 'shifts_cash' | 'bills_voids'>('overview_eod');

  // Void Modal State
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [billToVoid, setBillToVoid] = useState<Bill | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidManagerName, setVoidManagerName] = useState('Accounts Manager (placeholder)');

  // Shift Close Modal State
  const [shiftToClose, setShiftToClose] = useState<ShiftRecord | null>(null);
  const [actualCashInput, setActualCashInput] = useState('');

  // Open New Shift State
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [newShiftDept, setNewShiftDept] = useState<'reception' | 'pharmacy'>('reception');
  const [newShiftType, setNewShiftType] = useState<ShiftType>('Shift B');
  const [newShiftCashier, setNewShiftCashier] = useState('Cashier 2 (placeholder)');
  const [newShiftOpeningCash, setNewShiftOpeningCash] = useState('2000');

  // Active valid bills (not voided)
  const paidBills = bills.filter((b) => b.status === 'paid');
  const voidedBills = bills.filter((b) => b.status === 'voided');

  // STRICT REQUIREMENT: Reception total and Pharmacy total are shown SEPARATELY, NEVER combined as one!
  const receptionBills = paidBills.filter((b) => b.type === 'consultation' || b.type === 'procedure');
  const pharmacyBills = paidBills.filter((b) => b.type === 'pharmacy');

  // Reception Breakdown
  const recCash = receptionBills.filter((b) => b.paymentMethod === 'cash').reduce((sum, b) => sum + b.total, 0);
  const recUpi = receptionBills.filter((b) => b.paymentMethod === 'upi').reduce((sum, b) => sum + b.total, 0);
  const recCard = receptionBills.filter((b) => b.paymentMethod === 'card').reduce((sum, b) => sum + b.total, 0);
  const recTotal = recCash + recUpi + recCard;

  // Pharmacy Breakdown
  const phmCash = pharmacyBills.filter((b) => b.paymentMethod === 'cash').reduce((sum, b) => sum + b.total, 0);
  const phmUpi = pharmacyBills.filter((b) => b.paymentMethod === 'upi').reduce((sum, b) => sum + b.total, 0);
  const phmCard = pharmacyBills.filter((b) => b.paymentMethod === 'card').reduce((sum, b) => sum + b.total, 0);
  const phmTotal = phmCash + phmUpi + phmCard;

  // Doctor Daily Breakdown
  const doctorMetrics = doctors.map((doc) => {
    const docVisits = visits.filter((v) => v.doctorId === doc.id);
    const consultationBills = paidBills.filter(
      (b) => b.type === 'consultation' && b.items.some((i) => i.name.includes(doc.name) || i.name.includes(doc.tokenPrefix))
    );
    const totalConsultationFees = consultationBills.reduce((sum, b) => sum + b.total, 0);

    return {
      doctor: doc,
      patientCount: docVisits.length,
      totalFees: totalConsultationFees,
      billsCount: consultationBills.length,
    };
  });

  const handleOpenVoidModal = (bill: Bill) => {
    setBillToVoid(bill);
    setVoidReason('');
    // Default approver name to current user if different from bill cashier
    if (currentUser.name && currentUser.name !== bill.cashierName) {
      setVoidManagerName(currentUser.name);
    } else {
      setVoidManagerName('Accounts Manager (placeholder)');
    }
    setVoidModalOpen(true);
  };

  const handleConfirmVoid = async () => {
    if (!billToVoid) return;
    if (!voidReason.trim()) {
      showToast('error', 'SAFETY RULE: You MUST provide a clear reason for voiding this invoice.');
      return;
    }

    // Segregation of duties: Cashier who generated the invoice cannot approve the void!
    if (billToVoid.cashierName.trim().toLowerCase() === voidManagerName.trim().toLowerCase()) {
      showToast(
        'error',
        `SEGREGATION OF DUTIES VIOLATION: Cashier "${billToVoid.cashierName}" created this bill and CANNOT approve its void. A separate Accounts approver is required.`,
        'Approval Blocked'
      );
      return;
    }

    const success = await voidBill(billToVoid.id, voidReason, voidManagerName, 'ACCOUNTS');
    if (success) {
      setVoidModalOpen(false);
      setBillToVoid(null);
    }
  };

  const handleOpenCloseShiftModal = (shift: ShiftRecord) => {
    setShiftToClose(shift);
    setActualCashInput('');
  };

  const handleConfirmCloseShift = async () => {
    if (!shiftToClose) return;
    const actual = parseFloat(actualCashInput);
    if (isNaN(actual) || actual < 0) {
      showToast('error', 'Please enter a valid cash count amount.');
      return;
    }
    const success = await closeShift(shiftToClose.id, actual);
    if (success) {
      setShiftToClose(null);
    }
  };

  const handleCreateOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    const cash = parseFloat(newShiftOpeningCash) || 0;
    const ok = await openShift(newShiftDept, newShiftType, newShiftCashier, cash);
    if (ok) {
      setIsOpeningShift(false);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['INVOICE NO', 'TYPE', 'DATE', 'PATIENT MRN', 'PATIENT NAME', 'PAYMENT METHOD', 'UPI REF', 'SHIFT', 'CASHIER', 'STATUS', 'TOTAL (INR)'],
      ...bills.map((b) => [
        b.invoiceNo,
        b.type.toUpperCase(),
        new Date(b.timestamp).toISOString(),
        b.patientMrn,
        `"${b.patientName}"`,
        b.paymentMethod.toUpperCase(),
        b.upiRef || '',
        b.shift,
        `"${b.cashierName}"`,
        b.status.toUpperCase(),
        b.total.toFixed(2),
      ]),
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PJ_Medical_Accounts_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('success', 'Accounts report CSV exported successfully.');
  };

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-teal-700" />
            <span>Clinic Accounts & Shift Ledgers</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manager: <strong className="text-slate-700">{currentUser.name}</strong> · End of Day Reconciliations · Voids & Audits
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export to CSV and Print Buttons */}
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Summary</span>
          </button>

          {/* Sub Navigation */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg ml-2">
            <button
              onClick={() => setActiveTab('overview_eod')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'overview_eod'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              End-of-Day Totals
            </button>
            <button
              onClick={() => setActiveTab('shifts_cash')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'shifts_cash'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cashier Shifts ({shifts.length})
            </button>
            <button
              onClick={() => setActiveTab('bills_voids')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                activeTab === 'bills_voids'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Invoices & Voids ({bills.length})
            </button>
          </div>
        </div>
      </div>

      {/* GST Note Banner */}
      <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-600 flex items-center justify-between">
        <span className="font-medium">
          Tax Compliance Note: <strong>GST configuration pending - confirm with accountant.</strong> Healthcare outpatient consultations and basic clinical procedures are typically exempt under GST notification.
        </span>
        <span className="text-[11px] font-mono text-slate-500">Kerala Outpatient Prototype</span>
      </div>

      {/* TAB 1: END OF DAY TOTALS (Strict requirement: Reception and Pharmacy separate, never combined!) */}
      {activeTab === 'overview_eod' && (
        <div className="space-y-6">
          {/* Distinct Separation Notice */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Accounting Policy:</strong> Reception Revenue and Pharmacy Revenue are audited and held in separate registers with independent cash reconciliation. Never combined as a single pool.
            </span>
          </div>

          {/* Dual Ledger Columns: Reception vs Pharmacy */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* LEDGER 1: RECEPTION TOTAL */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    LEDGER A: RECEPTION
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    RECEPTION TOTAL
                  </h3>
                  <p className="text-xs text-slate-500">
                    Consultation Fees + Procedure Bills
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-teal-800">
                    ₹{recTotal.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {receptionBills.length} Invoices
                  </span>
                </div>
              </div>

              {/* Payment Split */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Cash</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{recCash.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">UPI</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{recUpi.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Card</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{recCard.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Reception Shift Breakdown */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase block mb-2">
                  Breakdown by Shift & Cashier
                </span>
                <div className="space-y-1.5 text-xs">
                  {['Shift A', 'Shift B'].map((sh) => {
                    const shBills = receptionBills.filter((b) => b.shift === sh);
                    const shTotal = shBills.reduce((s, b) => s + b.total, 0);

                    return (
                      <div key={sh} className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                        <span className="font-semibold text-slate-800">
                          {sh} ({shBills.length} bills)
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹{shTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* LEDGER 2: PHARMACY TOTAL */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    LEDGER B: PHARMACY
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    PHARMACY TOTAL
                  </h3>
                  <p className="text-xs text-slate-500">
                    Dispensed Medicine Invoices Only
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black font-mono text-indigo-800">
                    ₹{phmTotal.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[11px] text-slate-500 block">
                    {pharmacyBills.length} Invoices
                  </span>
                </div>
              </div>

              {/* Payment Split */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Cash</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{phmCash.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">UPI</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{phmUpi.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Card</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    ₹{phmCard.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Pharmacy Shift Breakdown */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase block mb-2">
                  Breakdown by Shift & Cashier
                </span>
                <div className="space-y-1.5 text-xs">
                  {['Shift A', 'Shift B'].map((sh) => {
                    const shBills = pharmacyBills.filter((b) => b.shift === sh);
                    const shTotal = shBills.reduce((s, b) => s + b.total, 0);

                    return (
                      <div key={sh} className="p-2.5 bg-slate-50 rounded border border-slate-200 flex justify-between">
                        <span className="font-semibold text-slate-800">
                          {sh} ({shBills.length} bills)
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          ₹{shTotal.toLocaleString('en-IN')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Daily Summary Per Doctor */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Daily Outpatient Consultation Summary Per Doctor
            </h3>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                  <tr>
                    <th className="px-4 py-2.5">Doctor Name</th>
                    <th className="px-4 py-2.5">Specialty</th>
                    <th className="px-4 py-2.5 text-center">Tokens Issued</th>
                    <th className="px-4 py-2.5 text-center">Billed Consultations</th>
                    <th className="px-4 py-2.5 text-right">Fee Rate (₹)</th>
                    <th className="px-4 py-2.5 text-right">Total Revenue (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctorMetrics.map((dm) => (
                    <tr key={dm.doctor.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{dm.doctor.name}</td>
                      <td className="px-4 py-3 text-slate-600">{dm.doctor.specialty}</td>
                      <td className="px-4 py-3 text-center font-mono font-bold">{dm.patientCount}</td>
                      <td className="px-4 py-3 text-center font-mono">{dm.billsCount}</td>
                      <td className="px-4 py-3 text-right font-mono">₹{dm.doctor.consultationFee}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-teal-800">
                        ₹{dm.totalFees.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                  <tr>
                    <td colSpan={2} className="px-4 py-2.5 text-slate-700">Total Consultation Collection:</td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {doctorMetrics.reduce((s, m) => s + m.patientCount, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-center font-mono">
                      {doctorMetrics.reduce((s, m) => s + m.billsCount, 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right">-</td>
                    <td className="px-4 py-2.5 text-right font-mono text-teal-900 text-sm">
                      ₹{doctorMetrics.reduce((s, m) => s + m.totalFees, 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CASHIER SHIFTS & RECONCILIATIONS */}
      {activeTab === 'shifts_cash' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Cash Drawer Shifts (Morning & Evening)
              </h3>
              <p className="text-xs text-slate-500">
                Opening float, collected cash, and physical count discrepancy tracking
              </p>
            </div>
            <button
              onClick={() => setIsOpeningShift(true)}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-lg shadow-xs cursor-pointer"
            >
              + Open New Shift
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shifts.map((s) => {
              const isOpen = s.status === 'open';

              return (
                <div
                  key={s.id}
                  className={`p-5 rounded-xl border ${
                    isOpen ? 'border-teal-300 bg-white shadow-xs' : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                        {s.department.toUpperCase()} REGISTER
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{s.shiftType}</h4>
                      <p className="text-xs text-slate-600">
                        Cashier: <strong>{s.cashierName}</strong>
                      </p>
                    </div>

                    <div className="text-right">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                          isOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {s.status}
                      </span>
                      <span className="text-[11px] text-slate-400 block mt-1 font-mono">
                        {new Date(s.openedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>

                  <div className="py-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block">Opening Cash Drawer:</span>
                      <span className="font-mono font-bold text-slate-900">
                        ₹{s.openingCash.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {s.status === 'closed' && (
                      <>
                        <div>
                          <span className="text-slate-500 block">Physical Cash Count:</span>
                          <span className="font-mono font-bold text-slate-900">
                            ₹{s.closingActualCash?.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Recorded Cash Sales:</span>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{s.calculatedCash?.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">Cash Discrepancy:</span>
                          <span
                            className={`font-mono font-bold ${
                              (s.difference || 0) === 0
                                ? 'text-emerald-700'
                                : (s.difference || 0) < 0
                                ? 'text-rose-600'
                                : 'text-blue-600'
                            }`}
                          >
                            {(s.difference || 0) >= 0 ? '+' : ''}₹{s.difference?.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </>
                    )}
                  </div>

                  {isOpen && (
                    <div className="pt-3 border-t border-slate-100 flex justify-end">
                      <button
                        onClick={() => handleOpenCloseShiftModal(s)}
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
                      >
                        Close Shift & Tally Cash
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: INVOICES & VOIDS (Never modify a paid bill; void with distinct Accounts approver) */}
      {activeTab === 'bills_voids' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Invoice Register & Void Approvals ({bills.length})
              </h3>
              <p className="text-xs text-slate-500">
                Rule: Paid bills are never edited in place. Segregation of Duties: Creator cannot approve their own void.
              </p>
            </div>
            <div className="text-xs font-semibold text-rose-600 bg-rose-50 px-2.5 py-1 rounded border border-rose-200">
              {voidedBills.length} Voided Invoice(s)
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="px-3 py-2.5">Invoice #</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Patient Name (MRN)</th>
                  <th className="px-3 py-2.5">Mode</th>
                  <th className="px-3 py-2.5">Shift & Cashier</th>
                  <th className="px-3 py-2.5 text-right">Amount (₹)</th>
                  <th className="px-3 py-2.5 text-center">Status</th>
                  <th className="px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-3 py-3 font-mono font-bold text-slate-900">{b.invoiceNo}</td>
                    <td className="px-3 py-3 uppercase font-semibold text-slate-600">{b.type}</td>
                    <td className="px-3 py-3">
                      <div className="font-bold text-slate-900">{b.patientName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{b.patientMrn}</div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-mono uppercase font-semibold">{b.paymentMethod}</span>
                      {b.upiRef && <div className="text-[10px] text-slate-400 font-mono">{b.upiRef}</div>}
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {b.shift} · {b.cashierName}
                    </td>
                    <td className="px-3 py-3 text-right font-mono font-bold text-slate-900">
                      ₹{b.total.toFixed(2)}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          b.status === 'paid'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800 line-through'
                        }`}
                      >
                        {b.status}
                      </span>
                      {b.status === 'voided' && b.voidReason && (
                        <div className="text-[10px] text-rose-600 mt-0.5">
                          "{b.voidReason}" (By {b.voidApprovedBy})
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {b.status === 'paid' ? (
                        <button
                          type="button"
                          onClick={() => handleOpenVoidModal(b)}
                          className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded transition-colors cursor-pointer"
                        >
                          Void Bill
                        </button>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Voided</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VOID BILL MODAL (Enforces Segregation of Duties) */}
      {voidModalOpen && billToVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 pb-3 border-b border-slate-100">
              <Ban className="w-5 h-5" />
              <h3 className="font-bold text-base text-slate-900">
                Void Invoice #{billToVoid.invoiceNo}
              </h3>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div>Patient: <strong>{billToVoid.patientName}</strong> ({billToVoid.patientMrn})</div>
              <div>Type: <strong className="uppercase">{billToVoid.type}</strong> · Amount: <strong>₹{billToVoid.total}</strong></div>
              <div>
                Created By Cashier: <strong className="text-teal-700">{billToVoid.cashierName}</strong> ({billToVoid.shift})
              </div>
            </div>

            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Segregation of Duties:</strong> The approver must be an Accounts role staff member distinct from the cashier who created the bill.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Accounts Approver Name *
              </label>
              <input
                type="text"
                required
                value={voidManagerName}
                onChange={(e) => setVoidManagerName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Voiding Invoice *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Duplicate token issued, patient left without receiving service, cashier billing error..."
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="w-full p-2.5 text-xs border border-slate-300 rounded focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              The original invoice is maintained in the database marked as "VOIDED" and logged to the audit trail.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setVoidModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
              >
                Confirm & Void Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CLOSE SHIFT MODAL */}
      {shiftToClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 pb-2 border-b border-slate-100">
              Close Shift: {shiftToClose.shiftType} ({shiftToClose.department.toUpperCase()})
            </h3>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
              <div>Cashier: <strong>{shiftToClose.cashierName}</strong></div>
              <div>Opening Float: <strong>₹{shiftToClose.openingCash}</strong></div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Physical Cash Counted in Drawer (₹) *
              </label>
              <input
                type="number"
                min="0"
                placeholder="Enter physical cash in drawer, e.g. 2900"
                value={actualCashInput}
                onChange={(e) => setActualCashInput(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-hidden"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                The app will calculate discrepancy = Actual Count - (Opening Float + Recorded Cash Sales).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShiftToClose(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseShift}
                className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs cursor-pointer"
              >
                Tally & Close Shift
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OPEN NEW SHIFT MODAL */}
      {isOpeningShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 p-6 space-y-4">
            <h3 className="font-bold text-base text-slate-900 pb-2 border-b border-slate-100">
              Open New Cashier Shift
            </h3>

            <form onSubmit={handleCreateOpenShift} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Department</label>
                <select
                  value={newShiftDept}
                  onChange={(e) => setNewShiftDept(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded"
                >
                  <option value="reception">Reception Register</option>
                  <option value="pharmacy">Pharmacy Counter</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Shift Type</label>
                <select
                  value={newShiftType}
                  onChange={(e) => setNewShiftType(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded"
                >
                  <option value="Shift A">Shift A (Morning 08:00 - 14:00)</option>
                  <option value="Shift B">Shift B (Evening 14:00 - 20:00)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cashier Name</label>
                <input
                  type="text"
                  required
                  value={newShiftCashier}
                  onChange={(e) => setNewShiftCashier(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Opening Cash Float (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newShiftOpeningCash}
                  onChange={(e) => setNewShiftOpeningCash(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsOpeningShift(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Open Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
