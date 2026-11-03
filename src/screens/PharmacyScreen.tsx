import React, { useState, useMemo } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  TokenVisit,
  PrescribedMedicine,
  PaymentMethod,
  DrugItem,
  DrugBatch,
  Bill
} from '../types';
import {
  Pill,
  CheckCircle2,
  Package,
  Receipt,
  QrCode,
  CreditCard,
  Banknote,
  Search,
  AlertTriangle,
  Clock,
  ExternalLink,
  History,
  Boxes,
  PlusCircle,
  Trash2,
  Printer,
  Ban,
  ShieldAlert,
  AlertCircle
} from 'lucide-react';

// Simulated current clinic date
const CLINIC_CURRENT_DATE = '2026-10-25';

function getDaysUntilExpiry(expiryDateStr: string): number {
  const exp = new Date(expiryDateStr).getTime();
  const cur = new Date(CLINIC_CURRENT_DATE).getTime();
  return Math.ceil((exp - cur) / (1000 * 60 * 60 * 24));
}

export const PharmacyScreen: React.FC = () => {
  const {
    visits,
    patients,
    drugs,
    batches,
    bills,
    shifts,
    currentUser,
    dispenseMedicine,
    cancelPharmacyDispensing,
    billAndCompletePharmacy,
    billRetailPharmacy,
    stockInBatch,
    writeOffBatch,
    setActiveReceiptBill,
    showToast,
    showConfirm,
  } = useClinic();

  // Active Pharmacy Shift (with safe fallback for initial load / closed shifts)
  const activeShift =
    shifts.find((s) => s.department === 'pharmacy' && s.status === 'open') ||
    shifts.find((s) => s.department === 'pharmacy') ||
    shifts[0] || {
      id: 'temp-pharmacy-shift',
      department: 'pharmacy',
      shiftType: 'Shift A' as const,
      cashierName: currentUser?.name || 'Pharmacist',
      status: 'open' as const,
      openedAt: new Date().toISOString(),
      openingCash: 1500,
    };

  // Tabs: dispensing, retail, billing history, inventory, stock-in, and write-off
  const [activeTab, setActiveTab] = useState<
    'dispensing_queue' | 'retail' | 'billed_patients' | 'inventory_batches' | 'stock_in' | 'write_off'
  >('dispensing_queue');

  // STAGE B: The pharmacy queue reads the saved prescription from the server
  const pharmacyQueue = useMemo(() => {
    return visits.filter((visit) => {
      const hasInHouseMedicine = visit.prescriptions?.some(
        (medicine) => !medicine.isOutsideMedicine
      );
      if (!hasInHouseMedicine) return false;

      // Keep the patient in dispensing until the pharmacy bill is generated,
      // including after all medicines have been dispensed.
      return (
        visit.status === 'waiting_pharmacy' ||
        visit.status === 'procedure_billing_pending' ||
        visit.status === 'nurse_check_pending'
      );
    });
  }, [visits]);

  const [selectedVisitId, setSelectedVisitId] = useState<string>(pharmacyQueue[0]?.id || '');

  // Keep selectedVisitId in sync with pharmacyQueue
  React.useEffect(() => {
    if (!selectedVisitId && pharmacyQueue.length > 0) {
      setSelectedVisitId(pharmacyQueue[0].id);
    } else if (selectedVisitId && !pharmacyQueue.some((v) => v.id === selectedVisitId) && pharmacyQueue.length > 0) {
      setSelectedVisitId(pharmacyQueue[0].id);
    }
  }, [pharmacyQueue, selectedVisitId]);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [upiRef, setUpiRef] = useState('');
  const [retailName, setRetailName] = useState('');
  const [retailPhone, setRetailPhone] = useState('');
  const [retailPatientId, setRetailPatientId] = useState('');
  const [retailSearch, setRetailSearch] = useState('');
  const [retailCart, setRetailCart] = useState<{ drugId: string; dosage: string; days: number; qty: number }[]>([]);
  const [retailPayment, setRetailPayment] = useState<PaymentMethod>('cash');
  const [retailUpiRef, setRetailUpiRef] = useState('');

  const retailTotal = retailCart.reduce((sum, item) => { const drug = drugs.find((d) => d.id === item.drugId); return sum + Number(drug?.unitPrice || 0) * item.qty; }, 0);
  const retailPredictions = retailSearch.trim()
    ? drugs.filter((drug) => `${drug.name} ${drug.strength}`.toLowerCase().includes(retailSearch.trim().toLowerCase())).slice(0, 8)
    : [];
  const addRetailDrug = (drugId: string) => {
    if (!retailCart.some((item) => item.drugId === drugId)) setRetailCart((items) => [...items, { drugId, dosage: '', days: 1, qty: 1 }]);
    setRetailSearch('');
  };
  const billRetail = async () => {
    const patient = patients.find((p) => p.id === retailPatientId);
    if (!retailCart.length) { showToast('warning', 'Add at least one medicine to the retail bill.'); return; }
    if (!patient && !retailPhone.trim()) { showToast('warning', 'Enter the outside customer mobile number.'); return; }
    if (retailCart.some((item) => !/^\d+-\d+-\d+$/.test(item.dosage.trim()))) { showToast('warning', 'Enter dosage in 0-0-0 format for every medicine.'); return; }
    if (retailCart.some((item) => item.days < 1)) { showToast('warning', 'Enter the number of days for every medicine.'); return; }
    if (retailPayment === 'upi' && !retailUpiRef.trim()) { showToast('warning', 'Enter the UPI reference.'); return; }
    const ok = await billRetailPharmacy({ patientId: patient?.id, name: patient?.name || retailName.trim() || 'Walk-in Customer', age: patient?.age || 0, sex: patient?.sex || 'Male', phone: patient?.phone || retailPhone.trim(), items: retailCart, paymentMethod: retailPayment, upiRef: retailPayment === 'upi' ? retailUpiRef.trim() : undefined });
    if (ok) { setRetailCart([]); setRetailName(''); setRetailPhone(''); setRetailPatientId(''); setRetailUpiRef(''); }
  };

  // Quantities to dispense per prescription index
  const [dispenseQtys, setDispenseQtys] = useState<{ [index: number]: number }>({});

  const activeVisit = visits.find((v) => v.id === selectedVisitId) || pharmacyQueue[0];
  const activePatient = patients.find((p) => p.id === activeVisit?.patientId);

  // --------------------------------------------------------------------------
  // TAB 2: Billed Patients State & Search
  // --------------------------------------------------------------------------
  const [billedSearch, setBilledSearch] = useState('');
  const pharmacyBills = useMemo(() => {
    return bills
      .filter((b) => b.type === 'pharmacy')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [bills]);

  const filteredBilledPatients = useMemo(() => {
    if (!billedSearch.trim()) return pharmacyBills;
    const q = billedSearch.toLowerCase().trim();
    return pharmacyBills.filter(
      (b) =>
        b.patientMrn.toLowerCase().includes(q) ||
        b.patientName.toLowerCase().includes(q) ||
        b.invoiceNo.toLowerCase().includes(q)
    );
  }, [pharmacyBills, billedSearch]);

  // --------------------------------------------------------------------------
  // TAB 3: Batch Inventory Stock Search
  // --------------------------------------------------------------------------
  const [batchSearch, setBatchSearch] = useState('');
  const [batchFilter, setBatchFilter] = useState<'all' | 'near_expiry' | 'expired'>('all');

  const getBatchDrugName = (b: DrugBatch): string => {
    return b.drugName || drugs.find((d) => d.id === b.drugId)?.name || 'Medicine';
  };

  const filteredBatches = useMemo(() => {
    return batches
      .filter((b) => b.status === 'active' && b.quantity > 0)
      .filter((b) => {
        const drugName = getBatchDrugName(b);
        const matchesQuery =
          drugName.toLowerCase().includes(batchSearch.toLowerCase()) ||
          b.batchNumber.toLowerCase().includes(batchSearch.toLowerCase()) ||
          b.supplier.toLowerCase().includes(batchSearch.toLowerCase());

        const days = getDaysUntilExpiry(b.expiryDate);
        if (batchFilter === 'expired') return matchesQuery && days <= 0;
        if (batchFilter === 'near_expiry') return matchesQuery && days > 0 && days <= 30;
        return matchesQuery;
      })
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
  }, [batches, drugs, batchSearch, batchFilter]);

  // --------------------------------------------------------------------------
  // TAB 4: Stock-In Form State
  // --------------------------------------------------------------------------
  const [stockInDrugId, setStockInDrugId] = useState(drugs[0]?.id || '');
  const [stockInBatchNum, setStockInBatchNum] = useState('');
  const [stockInExpiry, setStockInExpiry] = useState('');
  const [stockInQty, setStockInQty] = useState('');
  const [stockInPrice, setStockInPrice] = useState('');
  const [stockInSupplier, setStockInSupplier] = useState('Kerala State Medical Corp');

  const handleStockInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockInDrugId || !stockInBatchNum || !stockInExpiry || !stockInQty || !stockInPrice) {
      showToast('error', 'Please complete all required fields.');
      return;
    }

    const qty = parseInt(stockInQty, 10);
    const price = parseFloat(stockInPrice);

    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Quantity must be greater than 0.');
      return;
    }
    if (isNaN(price) || price < 0) {
      showToast('error', 'Purchase price cannot be negative.');
      return;
    }

    // Safety Check: Reject past or <30 day expiry
    const days = getDaysUntilExpiry(stockInExpiry);
    if (days <= 0) {
      showToast('error', 'REJECTED: Expiry date is in the past! Cannot stock expired drugs.', 'Safety Violation');
      return;
    }
    if (days <= 30) {
      showToast('error', `REJECTED: Batch expires in ${days} days (<30 days minimum shelf-life requirement).`, 'Safety Violation');
      return;
    }

    const success = await stockInBatch({
      drugId: stockInDrugId,
      batchNumber: stockInBatchNum.trim().toUpperCase(),
      expiryDate: stockInExpiry,
      quantity: qty,
      purchasePrice: price,
      supplier: stockInSupplier.trim(),
    });

    if (success) {
      setStockInBatchNum('');
      setStockInExpiry('');
      setStockInQty('');
      setStockInPrice('');
      setActiveTab('inventory_batches');
    }
  };

  // --------------------------------------------------------------------------
  // TAB 5: Write-Off Expired Batches State
  // --------------------------------------------------------------------------
  const [writeOffBatchId, setWriteOffBatchId] = useState('');
  const [writeOffReasonText, setWriteOffReasonText] = useState('');

  const selectedWriteOffBatch = batches.find((b) => b.id === writeOffBatchId);

  const handleWriteOffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWriteOffBatch) {
      showToast('error', 'Please select a batch to write off.');
      return;
    }
    if (!writeOffReasonText.trim()) {
      showToast('error', 'Please provide a formal reason for write-off.');
      return;
    }

    const lossAmount = selectedWriteOffBatch.quantity * selectedWriteOffBatch.purchasePrice;

    showConfirm({
      title: `Confirm Write-Off: ${getBatchDrugName(selectedWriteOffBatch)}?`,
      message: `You are writing off ${selectedWriteOffBatch.quantity} units from Batch ${selectedWriteOffBatch.batchNumber}. Total loss value: ₹${lossAmount.toLocaleString('en-IN')}. This action is permanent and logged in the audit trail.`,
      confirmLabel: 'Confirm Write-Off',
      danger: true,
      onConfirm: async () => {
        const ok = await writeOffBatch(selectedWriteOffBatch.id, writeOffReasonText);
        if (ok) {
          setWriteOffBatchId('');
          setWriteOffReasonText('');
        }
      },
    });
  };

  // --------------------------------------------------------------------------
  // DISPENSING ACTIONS
  // --------------------------------------------------------------------------
  const handleDispenseItem = async (idx: number, med: PrescribedMedicine) => {
    if (!activeVisit) return;
    const qty = dispenseQtys[idx] !== undefined ? dispenseQtys[idx] : med.qtyToDispense || 10;

    // Find earliest FEFO batch for this drug
    const drugBatches = batches
      .filter((b) => (b.drugId === med.drugId || b.drugName === med.drugName) && b.status === 'active' && b.quantity > 0)
      .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

    const earliestBatch = drugBatches[0];

    if (!earliestBatch) {
      showToast('error', `Out of stock: No available batch for ${med.drugName}.`, 'Stock Depleted');
      return;
    }

    const daysLeft = getDaysUntilExpiry(earliestBatch.expiryDate);

    // BLOCK EXPIRED
    if (daysLeft <= 0) {
      showToast(
        'error',
        `DISPENSE BLOCKED: Batch ${earliestBatch.batchNumber} expired on ${earliestBatch.expiryDate}! Write off this batch before dispensing.`,
        'Safety Violation: Expired Drug'
      );
      return;
    }

    // WARN NEAR-EXPIRY (<30 days)
    if (daysLeft <= 30) {
      showConfirm({
        title: `Near Expiry Warning (${daysLeft} days remaining)`,
        message: `Batch ${earliestBatch.batchNumber} expires on ${earliestBatch.expiryDate} (within 30 days). Do you still wish to dispense this batch?`,
        confirmLabel: 'Proceed with Dispensing',
        onConfirm: async () => {
          await dispenseMedicine(activeVisit.id, idx, qty);
        },
      });
      return;
    }

    await dispenseMedicine(activeVisit.id, idx, qty);
  };

  const handleGeneratePharmacyBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVisit) return;

    if (paymentMethod === 'upi' && !upiRef.trim()) {
      showToast('error', 'Please enter UPI Transaction Reference No.');
      return;
    }

    const ok = await billAndCompletePharmacy(activeVisit.id, paymentMethod, paymentMethod === 'upi' ? upiRef : undefined);
    if (ok) {
      setUpiRef('');
    }
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-3 overflow-hidden">
      {/* Top Header & Shift Banner */}
      <div className="shrink-0 bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-teal-50 border border-teal-200 rounded-lg">
            <Pill className="w-5 h-5 text-teal-700" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>PJ Pharmacy Counter & Dispensing</span>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-medium">
                {activeShift?.shiftType || 'Shift A'}
              </span>
            </h2>
            <p className="text-xs text-slate-500">
              Pharmacist: <strong className="text-slate-700">{currentUser.name}</strong> · FEFO Batch Dispensing · Independent Pharmacy Ledger
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            onClick={() => setActiveTab('dispensing_queue')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors relative flex items-center gap-2 cursor-pointer ${
              activeTab === 'dispensing_queue'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Pill className="w-3.5 h-3.5 text-teal-600" />
            <span>Dispensing</span>
            {pharmacyQueue.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-teal-600 text-white">
                {pharmacyQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('retail')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${activeTab === 'retail' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <Receipt className="w-3.5 h-3.5 text-emerald-600" />
            <span>Retail Pharmacy</span>
          </button>

          <button
            onClick={() => setActiveTab('billed_patients')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'billed_patients'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5 text-slate-500" />
            <span>Billed Patients ({pharmacyBills.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('inventory_batches')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'inventory_batches'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Boxes className="w-3.5 h-3.5 text-slate-500" />
            <span>Batch Inventory</span>
          </button>

          <button
            onClick={() => setActiveTab('stock_in')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'stock_in'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Stock-In</span>
          </button>

          <button
            onClick={() => setActiveTab('write_off')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
              activeTab === 'write_off'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
            <span>Write-Off</span>
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* TAB 1: DISPENSING QUEUE & BILLING                                    */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'dispensing_queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Left Column: Waiting Queue */}
          <div className="lg:col-span-4 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase pb-2 border-b border-slate-200">
              Patients for Dispensing ({pharmacyQueue.length})
            </h3>

            {pharmacyQueue.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 italic">
                No patients awaiting pharmacy dispensing.
              </div>
            ) : (
              <div className="space-y-2.5">
                {pharmacyQueue.map((v) => {
                  const pat = patients.find((p) => p.id === v.patientId);
                  const totalMeds = v.prescriptions?.length || 0;
                  const outsideCount = v.prescriptions?.filter((p) => p.isOutsideMedicine).length || 0;
                  const clinicUndispensed = v.prescriptions?.filter((p) => !p.isOutsideMedicine && !p.dispensed).length || 0;

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
                        <div className="flex items-center gap-1">
                          {outsideCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {outsideCount} outside
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                            {totalMeds} med{totalMeds !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-sm text-slate-800 mt-1">
                        {pat?.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center justify-between">
                        <span>MRN: {pat?.mrn}</span>
                        <span className="font-mono text-[10px] text-slate-400 capitalize">
                          {v.status.replace(/_/g, ' ')}
                        </span>
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

          {/* Right Column: Prescriptions, FEFO Batch Details, & Pharmacy Bill */}
          <div className="lg:col-span-8 min-h-0 overflow-y-auto bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-4">
            {activeVisit && activePatient ? (
              (() => {
                const allPrescriptions = activeVisit.prescriptions || [];
                const clinicMeds = allPrescriptions.filter((p) => !p.isOutsideMedicine);
                const outsideMeds = allPrescriptions.filter((p) => p.isOutsideMedicine);
                const dispensedMeds = clinicMeds.filter((p) => p.dispensed);

                const billableTotal = dispensedMeds.reduce(
                  (sum, item) => sum + (item.qtyDispensed || item.qtyToDispense || 1) * (item.unitPrice || 0),
                  0
                );

                return (
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
                            Age: {activePatient.age}y · Sex: {activePatient.sex} · Ph: {activePatient.phone}
                          </p>
                        </div>
                      </div>

                      {activePatient.allergies.length > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] uppercase text-rose-300 font-bold block">Patient Allergies</span>
                          <span className="text-xs font-bold text-white bg-rose-600 px-2 py-0.5 rounded inline-block">
                            ⚠️ {activePatient.allergies.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Prescriptions to Dispense & Outside Medicines (Exact match with doctor's prescription) */}
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                            <span>Doctor's Prescription ({allPrescriptions.length} items)</span>
                          </h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {clinicMeds.length} clinic · {outsideMeds.length} outside
                          </span>
                        </div>
                      </div>

                      {allPrescriptions.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-400 italic border border-dashed border-slate-300 rounded-xl">
                          No medicines currently prescribed for this visit.
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden">
                          {allPrescriptions.map((med, idx) => {
                            const catalogDrug = drugs.find((d) => d.id === med.drugId || d.name === med.drugName);
                            const isDispensed = med.dispensed;
                            const isOutside = med.isOutsideMedicine;

                            // Find FEFO active batches for clinic drug
                            const activeBatches = !isOutside
                              ? batches
                                  .filter(
                                    (b) =>
                                      (b.drugId === med.drugId || b.drugName === med.drugName) &&
                                      b.status === 'active' &&
                                      b.quantity > 0
                                  )
                                  .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
                              : [];

                            const earliestBatch = activeBatches[0];
                            const totalAvailableStock = activeBatches.reduce((s, b) => s + b.quantity, 0);

                            const daysLeft = earliestBatch ? getDaysUntilExpiry(earliestBatch.expiryDate) : null;
                            const isExpired = daysLeft !== null && daysLeft <= 0;
                            const isNearExpiry = daysLeft !== null && daysLeft > 0 && daysLeft <= 30;

                            // Allergy Class Warning (Stage 7 safety rule)
                            const allergyClass = catalogDrug?.allergyClass;
                            const isUnconfiguredAllergy = !isOutside && (!allergyClass || allergyClass.toLowerCase().includes('unconfigured'));
                            const hasAllergyConflict =
                              !isOutside &&
                              activePatient.allergies.length > 0 &&
                              allergyClass &&
                              activePatient.allergies.some((a) =>
                                allergyClass.toLowerCase().includes(a.toLowerCase()) ||
                                a.toLowerCase().includes(allergyClass.toLowerCase())
                              );

                            return (
                              <div
                                key={idx}
                                className={`p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-4 transition-colors ${
                                  isOutside ? 'bg-indigo-50/20' : 'bg-white'
                                }`}
                              >
                                <div className="space-y-2 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-sm text-slate-900">{med.drugName}</span>
                                    <span className="text-xs font-mono text-slate-600">
                                      {med.form} · {med.strength}
                                    </span>

                                    {/* Outside medicine vs Clinic source tag */}
                                    {isOutside ? (
                                      <span className="text-xs font-bold text-indigo-800 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1">
                                        <ExternalLink className="w-3.5 h-3.5" />
                                        Purchase outside
                                      </span>
                                    ) : (
                                      <span className="text-xs font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                        ₹{med.unitPrice} / unit
                                      </span>
                                    )}

                                    {/* Prescribed Quantity Badge */}
                                    <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                                      Qty: {med.qtyToDispense || med.qtyDispensed || 10}
                                    </span>

                                    {/* Allergy Class Tag */}
                                    {allergyClass && (
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        Class: {allergyClass}
                                      </span>
                                    )}
                                  </div>

                                  {/* Doctor Order: Dose, Frequency, Duration */}
                                  <div className="text-xs text-slate-700 flex flex-wrap items-center gap-1.5">
                                    <span className="text-slate-500">Doctor dose:</span>
                                    <span className="font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                                      {med.dose}
                                    </span>
                                    <span className="font-mono text-slate-600">
                                      ({med.frequency})
                                    </span>
                                    {med.duration && (
                                      <span className="text-slate-600">
                                        for <strong className="text-slate-800 font-mono">{med.duration}</strong>
                                      </span>
                                    )}
                                  </div>

                                  {med.instructions && (
                                    <div className="text-[11px] text-slate-500 italic">
                                      Instructions: {med.instructions}
                                    </div>
                                  )}

                                  {/* Allergy Warnings */}
                                  {hasAllergyConflict && (
                                    <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg text-xs font-bold text-rose-800 flex items-center gap-1.5">
                                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                                      <span>CONTRAINDICATION: Patient has allergy to {allergyClass}! Verify with doctor.</span>
                                    </div>
                                  )}
                                  {isUnconfiguredAllergy && (
                                    <div className="text-[11px] text-amber-700 flex items-center gap-1">
                                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                      <span>Allergy check not available for this drug - doctor to confirm.</span>
                                    </div>
                                  )}

                                  {/* Clinic FEFO Batch Information (Only for Clinic In-House Medicines) */}
                                  {!isOutside && (
                                    <div className="pt-1 text-xs">
                                      {earliestBatch ? (
                                        <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                                          <div className="flex items-center justify-between font-mono">
                                            <span className="text-slate-700">
                                              Earliest FEFO Batch: <strong>{earliestBatch.batchNumber}</strong> ({earliestBatch.supplier})
                                            </span>
                                            <span className="font-bold text-slate-900">
                                              Total Stock: {totalAvailableStock} units
                                            </span>
                                          </div>

                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="text-slate-600">
                                              Expiry Date: <strong>{earliestBatch.expiryDate}</strong> ({daysLeft} days)
                                            </span>

                                            {isExpired ? (
                                              <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                                EXPIRED - DISPENSE BLOCKED
                                              </span>
                                            ) : isNearExpiry ? (
                                              <span className="font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                                                NEAR EXPIRY (&lt;30 days)
                                              </span>
                                            ) : (
                                              <span className="text-emerald-700 font-semibold">
                                                Valid Batch
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-bold">
                                          Out of stock: No available batch found in clinic pharmacy.
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {isDispensed && (
                                    <div className="text-xs text-emerald-700 font-semibold flex items-center gap-1.5 pt-1">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                      <span>
                                        Dispensed {med.qtyDispensed} units at{' '}
                                        {new Date(med.dispensedAt || '').toLocaleTimeString('en-IN', {
                                          hour: '2-digit',
                                          minute: '2-digit',
                                        })}{' '}
                                        by {med.dispensedBy}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Dispense Action or Outside Medicine Badge */}
                                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                                  {isOutside ? (
                                    <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-center space-y-0.5">
                                      <div className="flex items-center justify-center gap-1 text-xs font-bold text-indigo-900">
                                        <ExternalLink className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>Purchase outside</span>
                                      </div>
                                      <span className="text-[10px] text-indigo-600 block">
                                        Not dispensed by clinic
                                      </span>
                                    </div>
                                  ) : !isDispensed ? (
                                    <>
                                      <div className="flex items-center gap-1">
                                        <span className="text-xs text-slate-500">Qty:</span>
                                        <input
                                          type="number"
                                          min="1"
                                          max={totalAvailableStock || 100}
                                          value={dispenseQtys[idx] !== undefined ? dispenseQtys[idx] : med.qtyToDispense || 10}
                                          onChange={(e) =>
                                            setDispenseQtys({
                                              ...dispenseQtys,
                                              [idx]: parseInt(e.target.value, 10) || 1,
                                            })
                                          }
                                          className="w-16 px-2 py-1.5 text-xs border border-slate-300 rounded font-mono text-center bg-white"
                                        />
                                      </div>

                                      <button
                                        type="button"
                                        disabled={!earliestBatch || isExpired || totalAvailableStock <= 0}
                                        onClick={() => handleDispenseItem(idx, med)}
                                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                                        title={
                                          isExpired
                                            ? 'Blocked: Batch is expired'
                                            : !earliestBatch
                                            ? 'Out of stock'
                                            : 'Dispense and deduct batch stock on server'
                                        }
                                      >
                                        <Package className="w-4 h-4" />
                                        <span>Dispense</span>
                                      </button>
                                    </>
                                  ) : (
                                    <span className="px-3 py-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-1">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      <span>Dispensed</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* SEPARATE PHARMACY BILL & PAYMENT */}
                    <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900 uppercase">
                            2. Pharmacy Bill & Cashier Collection
                          </h4>
                          <p className="text-xs text-slate-500">
                            Independent invoice and cash drawer from reception.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          {dispensedMeds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => showConfirm({
                                title: 'Cancel Pharmacy Bill?',
                                message: `Cancel dispensing for ${dispensedMeds.length} medicine${dispensedMeds.length === 1 ? '' : 's'} and return the dispensed quantity to stock? No payment has been recorded yet.`,
                                confirmLabel: 'Cancel Bill & Restore Stock',
                                isDestructive: true,
                                onConfirm: () => cancelPharmacyDispensing(activeVisit.id),
                              })}
                              className="px-3.5 py-2 text-xs font-bold text-rose-700 bg-white border border-rose-300 rounded-lg hover:bg-rose-50 cursor-pointer"
                            >
                              Cancel Bill
                            </button>
                          )}
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">Pharmacy Total Due</span>
                            <span className="text-2xl font-black font-mono text-teal-800">
                              ₹{billableTotal}
                            </span>
                          </div>
                        </div>
                      </div>

                      {dispensedMeds.length === 0 ? (
                        <div className="py-4 text-center text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                          ⚠️ Please click "Dispense" on at least one clinic medicine above before generating the pharmacy bill.
                        </div>
                      ) : (
                        <form onSubmit={handleGeneratePharmacyBill} className="space-y-4">
                          {/* Payment method selector */}
                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                              Pharmacy Payment Mode *
                            </label>
                            <div className="grid grid-cols-3 gap-3">
                              <label
                                className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                                  paymentMethod === 'cash'
                                    ? 'border-teal-600 bg-teal-50 font-bold text-teal-900'
                                    : 'border-slate-200 text-slate-700 bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="phmPayment"
                                  value="cash"
                                  checked={paymentMethod === 'cash'}
                                  onChange={() => setPaymentMethod('cash')}
                                  className="hidden"
                                />
                                <Banknote className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs">Cash</span>
                              </label>

                              <label
                                className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                                  paymentMethod === 'upi'
                                    ? 'border-teal-600 bg-teal-50 font-bold text-teal-900'
                                    : 'border-slate-200 text-slate-700 bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="phmPayment"
                                  value="upi"
                                  checked={paymentMethod === 'upi'}
                                  onChange={() => setPaymentMethod('upi')}
                                  className="hidden"
                                />
                                <QrCode className="w-4 h-4 text-blue-600" />
                                <span className="text-xs">UPI</span>
                              </label>

                              <label
                                className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                                  paymentMethod === 'card'
                                    ? 'border-teal-600 bg-teal-50 font-bold text-teal-900'
                                    : 'border-slate-200 text-slate-700 bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="phmPayment"
                                  value="card"
                                  checked={paymentMethod === 'card'}
                                  onChange={() => setPaymentMethod('card')}
                                  className="hidden"
                                />
                                <CreditCard className="w-4 h-4 text-purple-600" />
                                <span className="text-xs">Card</span>
                              </label>
                            </div>

                            {paymentMethod === 'upi' && (
                              <div className="mt-2">
                                <input
                                  type="text"
                                  placeholder="UPI Transaction Reference No. *"
                                  value={upiRef}
                                  onChange={(e) => setUpiRef(e.target.value)}
                                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-blue-300 rounded-md focus:outline-hidden"
                                />
                              </div>
                            )}
                          </div>

                          <button
                            type="submit"
                            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Receipt className="w-4 h-4" />
                            <span>Collect ₹{billableTotal}, Issue Pharmacy Bill & Complete Patient Journey</span>
                          </button>
                        </form>
                      )}
                    </div>
                  </>
                );
              })()
            ) : (
              <div className="py-20 text-center text-slate-400 italic">
                Select a patient from the queue to dispense medications and generate the pharmacy bill.
              </div>
            )}
          </div>
        </div>
      )}

      {/* RETAIL / OUTSIDE CUSTOMER */}
      {activeTab === 'retail' && (
        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-3 flex-1 min-h-0 overflow-hidden">
          <div className="min-h-0 bg-white border border-slate-200 rounded-xl shadow-xs overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">Retail Sale</h3>
              <p className="text-xs text-slate-500 mt-1">Search medicines, add quantities and create the customer bill.</p>
            </div>
            <div className="p-5 border-b border-slate-200">
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">Find medicine</label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input value={retailSearch} onChange={(e) => setRetailSearch(e.target.value)} placeholder="Search medicine name, strength or generic name..." className="w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                {retailPredictions.length > 0 && (
                  <div className="absolute z-30 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden">
                    {retailPredictions.map((drug) => {
                      const stock = batches.filter((b) => b.drugId === drug.id && !b.isWrittenOff).reduce((sum, b) => sum + b.quantity, 0);
                      return (
                        <button key={drug.id} onClick={() => addRetailDrug(drug.id)} className="w-full px-4 py-3 text-left hover:bg-teal-50 border-b border-slate-100 last:border-0 flex items-center justify-between cursor-pointer">
                          <span><span className="font-bold text-sm text-slate-900">{drug.name} {drug.strength}</span><span className="block text-[11px] text-slate-500">{drug.form} · {drug.genericName}</span></span>
                          <span className="text-right"><span className="block text-xs font-bold text-teal-700">₹{drug.unitPrice}</span><span className="text-[11px] text-slate-500">Stock: {stock}</span></span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 text-slate-600 uppercase font-semibold">
                  <tr><th className="px-5 py-3">Medicine</th><th className="px-3 py-3 text-center">Qty</th><th className="px-3 py-3">Dosage</th><th className="px-3 py-3">Days</th><th className="px-3 py-3 text-right">Price</th><th className="px-3 py-3 text-right">Amount</th><th className="px-4 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailCart.map((item, index) => {
                    const drug = drugs.find((d) => d.id === item.drugId);
                    const stock = batches.filter((b) => b.drugId === item.drugId && !b.isWrittenOff).reduce((sum, b) => sum + b.quantity, 0);
                    return (
                      <tr key={item.drugId} className="hover:bg-slate-50">
                        <td className="px-5 py-3"><div className="font-bold text-sm text-slate-900">{drug?.name}</div><div className="text-[11px] text-slate-500">{drug?.strength} · Stock {stock}</div></td>
                        <td className="px-3 py-3"><input aria-label="Quantity" type="number" min="1" max={stock} value={item.qty} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, qty: Math.max(1, Number(e.target.value) || 1) } : it))} className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-center font-bold" /></td>
                        <td className="px-3 py-3"><input aria-label="Dosage" value={item.dosage} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, dosage: e.target.value.replace(/[^0-9-]/g, '') } : it))} placeholder="1-0-1" className="w-24 px-2 py-2 border border-slate-300 rounded-lg font-mono" /></td>
                        <td className="px-3 py-3"><input aria-label="Days" type="number" min="1" value={item.days} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, days: Math.max(1, Number(e.target.value) || 1) } : it))} className="w-16 px-2 py-2 border border-slate-300 rounded-lg text-center" /></td>
                        <td className="px-3 py-3 text-right font-mono">₹{drug?.unitPrice}</td>
                        <td className="px-3 py-3 text-right font-bold font-mono">₹{((drug?.unitPrice || 0) * item.qty).toFixed(2)}</td>
                        <td className="px-4 py-3"><button onClick={() => setRetailCart((items) => items.filter((_, i) => i !== index))} className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer" title="Remove medicine"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                  {!retailCart.length && <tr><td colSpan={7} className="py-16 text-center"><Package className="w-8 h-8 mx-auto text-slate-300 mb-2" /><span className="text-sm text-slate-400">Search and add medicines to begin a retail bill</span></td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xs">
            <div className="px-5 py-4 border-b border-slate-200"><h3 className="text-sm font-bold text-slate-900 uppercase">Customer & Payment</h3></div>
            <div className="p-5 space-y-4">
              <div><label className="text-xs font-bold text-slate-700 mb-1.5 block">Customer</label><select value={retailPatientId} onChange={(e) => setRetailPatientId(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white"><option value="">Walk-in customer</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}</select></div>
              {!retailPatientId && <div className="grid grid-cols-1 gap-3"><input value={retailPhone} onChange={(e) => setRetailPhone(e.target.value)} placeholder="Mobile number *" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" /><input value={retailName} onChange={(e) => setRetailName(e.target.value)} placeholder="Customer name (optional)" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" /></div>}
              <div><label className="text-xs font-bold text-slate-700 mb-1.5 block">Payment method</label><div className="grid grid-cols-3 gap-2">{(['cash','upi','card'] as PaymentMethod[]).map((method) => <button key={method} onClick={() => setRetailPayment(method)} className={`py-2.5 border rounded-lg text-xs font-bold capitalize cursor-pointer ${retailPayment === method ? 'border-teal-600 bg-teal-50 text-teal-700 ring-1 ring-teal-600' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>{method}</button>)}</div></div>
              {retailPayment === 'upi' && <input value={retailUpiRef} onChange={(e) => setRetailUpiRef(e.target.value)} placeholder="UPI reference *" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm" />}
              <div className="border-t border-dashed border-slate-300 pt-4 space-y-2"><div className="flex justify-between text-xs text-slate-500"><span>Items</span><span>{retailCart.reduce((sum, item) => sum + item.qty, 0)}</span></div><div className="flex justify-between items-end pt-2"><span className="font-bold text-slate-700">Net payable</span><span className="text-3xl font-black text-teal-800 font-mono">₹{retailTotal.toFixed(2)}</span></div></div>
              <button onClick={billRetail} disabled={!retailCart.length} className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2 cursor-pointer"><Printer className="w-4 h-4" />Generate Bill & Print</button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 2: BILLED PATIENTS LIST (Reprint & Void Indicators)               */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'billed_patients' && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Previously Billed Pharmacy Patients ({pharmacyBills.length})
              </h3>
              <p className="text-xs text-slate-500">
                Click any bill to view or reprint thermal receipt. Voided bills are marked clearly.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by MRN, invoice #, or patient..."
                value={billedSearch}
                onChange={(e) => setBilledSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Invoice #</th>
                  <th className="px-4 py-2.5">Date & Time</th>
                  <th className="px-4 py-2.5">Patient Name (MRN)</th>
                  <th className="px-4 py-2.5">Mode</th>
                  <th className="px-4 py-2.5">Cashier</th>
                  <th className="px-4 py-2.5 text-right">Total (₹)</th>
                  <th className="px-4 py-2.5 text-center">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBilledPatients.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-xs text-slate-400 italic">
                      No pharmacy invoices match your search.
                    </td>
                  </tr>
                ) : (
                  filteredBilledPatients.map((bill) => {
                    const isVoided = bill.status === 'voided';

                    return (
                      <tr key={bill.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">
                          {bill.invoiceNo}
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-500">
                          {new Date(bill.timestamp).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                          })}{' '}
                          {new Date(bill.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{bill.patientName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{bill.patientMrn}</div>
                        </td>
                        <td className="px-4 py-3 font-mono uppercase text-slate-700">
                          {bill.paymentMethod}
                          {bill.upiRef && <div className="text-[10px] text-slate-400">Ref: {bill.upiRef}</div>}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {bill.cashierName} ({bill.shift})
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          ₹{bill.total.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isVoided ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center justify-center gap-1">
                              <Ban className="w-3 h-3 text-rose-600" />
                              <span>VOIDED</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>PAID</span>
                            </span>
                          )}
                          {isVoided && bill.voidReason && (
                            <div className="text-[9px] text-rose-600 mt-0.5 truncate max-w-xs">
                              "{bill.voidReason}"
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActiveReceiptBill(bill)}
                            className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded flex items-center gap-1 ml-auto cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 3: BATCH INVENTORY & EXPIRY TRACKING                             */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'inventory_batches' && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Batch-Based Stock & FEFO Expiry Tracking
              </h3>
              <p className="text-xs text-slate-500">
                Sorted by FEFO (earliest expiry first). Clinical simulation anchor date: <strong>{CLINIC_CURRENT_DATE}</strong>.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium"
              >
                <option value="all">All Active Batches</option>
                <option value="near_expiry">Near Expiry (&lt;30 days)</option>
                <option value="expired">Expired Batches</option>
              </select>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search drug or batch #..."
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                <tr>
                  <th className="px-4 py-2.5">Drug Name</th>
                  <th className="px-4 py-2.5">Batch Number</th>
                  <th className="px-4 py-2.5">Supplier</th>
                  <th className="px-4 py-2.5">Expiry Date</th>
                  <th className="px-4 py-2.5 text-center">Remaining Shelf Life</th>
                  <th className="px-4 py-2.5 text-center">Stock Qty</th>
                  <th className="px-4 py-2.5 text-right">Purchase Price (₹)</th>
                  <th className="px-4 py-2.5">Batch Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBatches.map((b) => {
                  const daysLeft = getDaysUntilExpiry(b.expiryDate);
                  const isExpired = daysLeft <= 0;
                  const isNearExpiry = daysLeft > 0 && daysLeft <= 30;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-bold text-slate-900">{getBatchDrugName(b)}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-700">{b.batchNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{b.supplier}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-800">{b.expiryDate}</td>
                      <td className="px-4 py-3 text-center font-mono">
                        {isExpired ? (
                          <span className="font-bold text-rose-600">Expired ({Math.abs(daysLeft)}d ago)</span>
                        ) : (
                          <span className={isNearExpiry ? 'font-bold text-amber-600' : 'text-slate-700'}>
                            {daysLeft} days
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-900">
                        {b.quantity}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">
                        ₹{b.purchasePrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        {isExpired ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            BLOCKED (Expired)
                          </span>
                        ) : isNearExpiry ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300">
                            Near Expiry (&lt;30d)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-300">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 4: STOCK-IN FORM (Stage 6)                                       */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'stock_in' && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-5 shadow-xs max-w-2xl space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
              <PlusCircle className="w-5 h-5 text-teal-600" />
              <span>Drug Stock-In Form</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Receive a new drug batch. Strict Safety Rule: Expiry date must be at least 30 days in the future from today ({CLINIC_CURRENT_DATE}).
            </p>
          </div>

          <form onSubmit={handleStockInSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select Drug *</label>
              <select
                required
                value={stockInDrugId}
                onChange={(e) => setStockInDrugId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
              >
                {drugs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.form} · {d.strength}) - Current Stock: {d.stockQty}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Batch Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. PCM-2027-04"
                  value={stockInBatchNum}
                  onChange={(e) => setStockInBatchNum(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Expiry Date * (Min &gt; 30 days ahead)
                </label>
                <input
                  type="date"
                  required
                  value={stockInExpiry}
                  onChange={(e) => setStockInExpiry(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Quantity Received (Units) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  placeholder="e.g. 100"
                  value={stockInQty}
                  onChange={(e) => setStockInQty(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Purchase Price Per Unit (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  placeholder="e.g. 1.80"
                  value={stockInPrice}
                  onChange={(e) => setStockInPrice(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Supplier Name *</label>
              <input
                type="text"
                required
                value={stockInSupplier}
                onChange={(e) => setStockInSupplier(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg"
              />
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[11px] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Safety Check: The system automatically verifies that the expiry date is not in the past or within 30 days. Stock and audit logs will update immediately.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Receive & Stock-In Batch</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* TAB 5: WRITE-OFF EXPIRED BATCHES (Stage 6)                           */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'write_off' && (
        <div className="min-h-0 flex-1 overflow-y-auto bg-white rounded-xl border border-slate-200 p-5 shadow-xs max-w-2xl space-y-4">
          <div className="pb-3 border-b border-slate-200">
            <div className="flex items-center gap-2 text-rose-800 font-bold text-base">
              <Trash2 className="w-5 h-5 text-rose-600" />
              <span>Write-Off Expired or Damaged Stock</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Permanently mark expired stock as discarded. Computes financial loss and logs an immutable audit trail.
            </p>
          </div>

          <form onSubmit={handleWriteOffSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select Batch to Write Off *
              </label>
              <select
                required
                value={writeOffBatchId}
                onChange={(e) => setWriteOffBatchId(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg bg-white font-medium"
              >
                <option value="">-- Choose a batch --</option>
                {batches
                  .filter((b) => b.status === 'active' && b.quantity > 0)
                  .map((b) => {
                    const days = getDaysUntilExpiry(b.expiryDate);
                    const isExp = days <= 0;
                    return (
                      <option key={b.id} value={b.id}>
                        {getBatchDrugName(b)} (Batch: {b.batchNumber}, Qty: {b.quantity}) - Exp: {b.expiryDate}{' '}
                        {isExp ? '[EXPIRED]' : `[${days}d left]`}
                      </option>
                    );
                  })}
              </select>
            </div>

            {selectedWriteOffBatch && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="font-bold text-rose-900 text-sm">
                  Write-Off Batch Details: {getBatchDrugName(selectedWriteOffBatch)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    Batch Number: <strong className="font-mono">{selectedWriteOffBatch.batchNumber}</strong>
                  </div>
                  <div>
                    Quantity to Discard: <strong className="font-mono">{selectedWriteOffBatch.quantity} units</strong>
                  </div>
                  <div>
                    Unit Cost: <strong className="font-mono">₹{selectedWriteOffBatch.purchasePrice.toFixed(2)}</strong>
                  </div>
                  <div>
                    Calculated Loss Value:{' '}
                    <strong className="font-mono text-rose-700 text-sm">
                      ₹{(selectedWriteOffBatch.quantity * selectedWriteOffBatch.purchasePrice).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Reason for Write-Off *
              </label>
              <textarea
                rows={3}
                required
                placeholder="e.g. Expired on 2026-10-10, disposed via clinical waste handler per biomedical disposal protocol."
                value={writeOffReasonText}
                onChange={(e) => setWriteOffReasonText(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:border-rose-500 focus:outline-hidden"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="submit"
                disabled={!selectedWriteOffBatch}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Confirm Write-Off & Record Financial Loss</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
