import React, { useState, useMemo, useRef } from 'react';
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
  AlertCircle,
  Camera,
  X
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
    returnPharmacyItems,
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
  const [retailScannerOpen, setRetailScannerOpen] = useState(false);
  const retailScannerVideoRef = useRef<HTMLVideoElement>(null);
  const retailScannerStreamRef = useRef<MediaStream | null>(null);
  const retailScannerFrameRef = useRef<number | null>(null);
  const retailScannerDetectorRef = useRef<any>(null);

  const retailTotal = retailCart.reduce((sum, item) => { const drug = drugs.find((d) => d.id === item.drugId); return sum + Number(drug?.unitPrice || 0) * item.qty; }, 0);
  const retailPredictions = retailSearch.trim()
    ? drugs.filter((drug) => `${drug.name} ${drug.strength}`.toLowerCase().includes(retailSearch.trim().toLowerCase())).slice(0, 8)
    : [];
  const addRetailDrug = (drugId: string) => {
    if (!retailCart.some((item) => item.drugId === drugId)) setRetailCart((items) => [...items, { drugId, dosage: '', days: 1, qty: 1 }]);
    setRetailSearch('');
  };

  const stopRetailScanner = () => {
    if (retailScannerFrameRef.current !== null) {
      cancelAnimationFrame(retailScannerFrameRef.current);
      retailScannerFrameRef.current = null;
    }
    retailScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    retailScannerStreamRef.current = null;
    retailScannerDetectorRef.current = null;
    setRetailScannerOpen(false);
  };

  const findRetailDrugFromCode = (rawValue: string) => {
    const value = rawValue.trim();
    let drugMatch = drugs.find((drug) => drug.id === value);

    try {
      const parsed = JSON.parse(value);
      const drugId = String(parsed.drugId || parsed.id || parsed.medicineId || parsed.itemId || '');
      const drugName = String(parsed.drugName || parsed.name || parsed.medicine || parsed.item || '');
      const batchNumber = String(parsed.batchNumber || parsed.batch || parsed.lotNumber || parsed.lot || '');
      const batchDrugId = batchNumber
        ? batches.find((batch) => batch.batchNumber.toLowerCase() === batchNumber.toLowerCase())?.drugId
        : undefined;
      drugMatch = drugs.find((drug) => drug.id === drugId) ||
        drugs.find((drug) => drug.id === batchDrugId) ||
        drugs.find((drug) => `${drug.name} ${drug.strength}`.toLowerCase() === drugName.toLowerCase()) ||
        drugs.find((drug) => drug.name.toLowerCase() === drugName.toLowerCase());
    } catch {
      const batchMatch = batches.find((batch) => batch.batchNumber.toLowerCase() === value.toLowerCase());
      drugMatch = drugMatch || (batchMatch ? drugs.find((drug) => drug.id === batchMatch.drugId) : undefined);
      if (!drugMatch) {
        const searchableValue = value.toLowerCase();
        drugMatch = drugs.find((drug) => `${drug.name} ${drug.strength}`.toLowerCase() === searchableValue) ||
          drugs.find((drug) => drug.name.toLowerCase() === searchableValue);
      }
    }

    if (!drugMatch) {
      showToast('warning', 'No matching medicine was found for the scanned code. Try scanning the medicine label or enter it manually.');
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const stock = batches
      .filter((batch) => batch.drugId === drugMatch?.id && batch.status !== 'written_off' && !batch.isWrittenOff && batch.quantity > 0 && batch.expiryDate >= today)
      .reduce((sum, batch) => sum + batch.quantity, 0);
    if (stock <= 0) {
      showToast('warning', `${drugMatch.name} has no active batch stock and cannot be added.`);
      return;
    }

    addRetailDrug(drugMatch.id);
    stopRetailScanner();
    showToast('success', `${drugMatch.name} added to the retail bill.`);
  };

  const startRetailScanner = async () => {
    const BarcodeDetector = (window as any).BarcodeDetector;
    if (!BarcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      showToast('warning', 'QR/barcode scanning is not available in this browser. Use Chrome on a secure connection or search manually.');
      return;
    }

    try {
      setRetailScannerOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      retailScannerStreamRef.current = stream;
      if (!retailScannerVideoRef.current) throw new Error('Camera preview unavailable');
      retailScannerVideoRef.current.srcObject = stream;
      await retailScannerVideoRef.current.play();
      retailScannerDetectorRef.current = new BarcodeDetector({ formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a'] });

      const scanFrame = async () => {
        const video = retailScannerVideoRef.current;
        if (video && video.readyState >= 2 && retailScannerDetectorRef.current) {
          try {
            const codes = await retailScannerDetectorRef.current.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              findRetailDrugFromCode(codes[0].rawValue);
              return;
            }
          } catch {
            // Continue scanning.
          }
        }
        retailScannerFrameRef.current = requestAnimationFrame(scanFrame);
      };
      retailScannerFrameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      stopRetailScanner();
      showToast('error', 'Camera access was blocked or unavailable. Please allow camera permission and try again.');
    }
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

  const [returnBill, setReturnBill] = useState<Bill | null>(null);
  const [returnQuantities, setReturnQuantities] = useState<{ [itemIndex: number]: number }>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnRefundMethod, setReturnRefundMethod] = useState<PaymentMethod>('cash');

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
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerStatus, setScannerStatus] = useState('');
  const stockScannerVideoRef = useRef<HTMLVideoElement>(null);
  const stockScannerStreamRef = useRef<MediaStream | null>(null);
  const stockScannerFrameRef = useRef<number | null>(null);
  const stockScannerDetectorRef = useRef<any>(null);

  const stopStockScanner = () => {
    if (stockScannerFrameRef.current !== null) {
      cancelAnimationFrame(stockScannerFrameRef.current);
      stockScannerFrameRef.current = null;
    }
    stockScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
    stockScannerStreamRef.current = null;
    stockScannerDetectorRef.current = null;
    setScannerOpen(false);
  };

  const applyScannedStockData = (rawValue: string) => {
    const value = rawValue.trim();
    const normalized = value.replace(/[\r\n]/g, '').replace(/\x1d/g, '|');
    let batchNumber = '';
    let expiry = '';
    let quantity = '';

    try {
      const parsedJson = JSON.parse(value);
      batchNumber = String(parsedJson.batchNumber || parsedJson.batch || parsedJson.lot || parsedJson.lotNumber || '');
      expiry = String(parsedJson.expiryDate || parsedJson.expiry || parsedJson.exp || '');
      quantity = String(parsedJson.quantity || parsedJson.qty || parsedJson.receivedQuantity || '');
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(expiry)) {
        const [day, month, year] = expiry.split('/');
        expiry = `${year}-${month}-${day}`;
      }
    } catch {
      // Other QR formats are handled by GS1 and label parsing below.
    }

    const gs1Expiry = normalized.match(/(?:\(17\)|17)(\d{6})/i);
    if (gs1Expiry) {
      const yy = gs1Expiry[1].slice(0, 2);
      const month = gs1Expiry[1].slice(2, 4);
      const day = gs1Expiry[1].slice(4, 6) || '01';
      expiry = `20${yy}-${month}-${day === '00' ? '01' : day}`;
    }

    const gs1Batch = normalized.match(/(?:\(10\)|10)([^|\s]+)/i);
    if (gs1Batch) batchNumber = gs1Batch[1];
    const gs1Quantity = normalized.match(/(?:\(30\)|30)(\d+)/i);
    if (gs1Quantity) quantity = gs1Quantity[1];

    if (!expiry) {
      const labelledExpiry = value.match(/(?:expiry(?:\s*date)?|exp)[:\s-]*(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4}|\d{6})/i);
      if (labelledExpiry) {
        const rawExpiry = labelledExpiry[1];
        if (/^\d{6}$/.test(rawExpiry)) {
          expiry = `20${rawExpiry.slice(0, 2)}-${rawExpiry.slice(2, 4)}-${rawExpiry.slice(4, 6) === '00' ? '01' : rawExpiry.slice(4, 6)}`;
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawExpiry)) {
          expiry = rawExpiry;
        } else {
          const parts = rawExpiry.split(/[/-]/);
          expiry = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
      }
    }
    if (!quantity) {
      const labelledQuantity = value.match(/(?:quantity|qty|received)[:\s-]*(\d+)/i);
      if (labelledQuantity) quantity = labelledQuantity[1];
    }
    if (!batchNumber) {
      const labelledBatch = value.match(/(?:batch(?:\s*(?:number|no\.?)?)?|lot)[:\s-]*([A-Za-z0-9_-]+)/i);
      batchNumber = labelledBatch?.[1] || value;
    }

    setStockInBatchNum(batchNumber.trim().toUpperCase());
    if (expiry) setStockInExpiry(expiry);
    if (quantity) setStockInQty(quantity);
    stopStockScanner();
    showToast('success', 'QR code scanned. Stock details have been filled.');
  };

  const startStockScanner = async () => {
    const barcodeDetector = (window as any).BarcodeDetector;
    if (!barcodeDetector || !navigator.mediaDevices?.getUserMedia) {
      showToast('warning', 'QR scanning is not available on this browser. You can enter the batch details manually.');
      return;
    }

    try {
      setScannerOpen(true);
      setScannerStatus('Starting camera...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      stockScannerStreamRef.current = stream;
      if (!stockScannerVideoRef.current) throw new Error('Camera preview unavailable');
      stockScannerVideoRef.current.srcObject = stream;
      await stockScannerVideoRef.current.play();

      const detector = new barcodeDetector({ formats: ['qr_code'] });
      stockScannerDetectorRef.current = detector;
      setScannerStatus('Position the QR code inside the camera view');

      const scanFrame = async () => {
        const video = stockScannerVideoRef.current;
        if (video && video.readyState >= 2 && stockScannerDetectorRef.current) {
          try {
            const codes = await stockScannerDetectorRef.current.detect(video);
            if (codes.length > 0 && codes[0].rawValue) {
              applyScannedStockData(codes[0].rawValue);
              return;
            }
          } catch {
            // Continue scanning until the user closes the camera.
          }
        }
        stockScannerFrameRef.current = requestAnimationFrame(scanFrame);
      };
      stockScannerFrameRef.current = requestAnimationFrame(scanFrame);
    } catch (error) {
      stopStockScanner();
      setScannerStatus('Camera access failed');
      showToast('error', 'Camera access was blocked or unavailable. Please allow camera permission and try again.');
    }
  };

  React.useEffect(() => () => {
    if (stockScannerFrameRef.current !== null) cancelAnimationFrame(stockScannerFrameRef.current);
    stockScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  React.useEffect(() => {
    if (activeTab !== 'stock_in') stopStockScanner();
  }, [activeTab]);

  React.useEffect(() => {
    if (activeTab !== 'retail') stopRetailScanner();
  }, [activeTab]);

  React.useEffect(() => () => {
    if (retailScannerFrameRef.current !== null) cancelAnimationFrame(retailScannerFrameRef.current);
    retailScannerStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

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
      {/* TAB 1: DISPENSING QUEUE & BILLING - COMPACT POS LAYOUT */}
      {/* -------------------------------------------------------------------- */}
      {activeTab === 'dispensing_queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(220px,.9fr)_minmax(0,3.1fr)] gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Patient queue */}
          <aside className="min-h-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
            <div className="shrink-0 px-3 py-2.5 border-b border-slate-200 bg-slate-50/70">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Patients for Dispensing ({pharmacyQueue.length})
              </h3>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-2">
              {pharmacyQueue.length === 0 ? (
                <div className="h-full min-h-28 flex items-center justify-center text-center text-xs text-slate-400 italic px-4">
                  No patients awaiting pharmacy dispensing.
                </div>
              ) : pharmacyQueue.map((visit) => {
                const patient = patients.find((p) => p.id === visit.patientId);
                const medicines = visit.prescriptions || [];
                const clinicUndispensed = medicines.filter((p) => !p.isOutsideMedicine && !p.dispensed).length;
                return (
                  <button
                    key={visit.id}
                    type="button"
                    onClick={() => setSelectedVisitId(visit.id)}
                    className={`w-full text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      activeVisit?.id === visit.id
                        ? 'border-teal-600 bg-teal-50 ring-1 ring-teal-600'
                        : 'border-slate-200 bg-white hover:border-teal-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-black text-sm text-slate-900">{visit.tokenNumber}</span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${clinicUndispensed ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {clinicUndispensed ? `${clinicUndispensed} pending` : 'Ready to bill'}
                      </span>
                    </div>
                    <div className="mt-1 font-bold text-sm text-slate-900 truncate">{patient?.name}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-mono">{patient?.mrn}</span>
                      <span>{medicines.length} med{medicines.length === 1 ? '' : 's'}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Main dispensing POS */}
          <div className="min-h-0 overflow-hidden bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col">
            {!activeVisit || !activePatient ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-400">
                Select a patient from the dispensing queue.
              </div>
            ) : (() => {
              const allPrescriptions = activeVisit.prescriptions || [];
              const clinicMeds = allPrescriptions.filter((medicine) => !medicine.isOutsideMedicine);
              const dispensedMeds = clinicMeds.filter((medicine) => medicine.dispensed);
              const billableTotal = dispensedMeds.reduce(
                (sum, medicine) => sum + (medicine.qtyDispensed || medicine.qtyToDispense || 1) * (medicine.unitPrice || 0),
                0
              );

              return (
                <>
                  {/* Patient header */}
                  <div className="shrink-0 px-3 py-2 bg-slate-900 text-white grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 items-center">
                    <div className="h-12 px-2.5 bg-teal-500/20 border border-teal-500/40 rounded-lg text-center flex flex-col justify-center">
                      <span className="text-[9px] uppercase font-bold text-teal-300">Token</span>
                      <span className="text-lg font-black font-mono">{activeVisit.tokenNumber}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className="font-bold text-sm truncate">{activePatient.name}</h3>
                        <span className="text-[11px] font-mono text-slate-400 shrink-0">{activePatient.mrn}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 truncate">
                        Age {activePatient.age} · {activePatient.sex} · {activePatient.phone}
                      </p>
                    </div>
                    {activePatient.allergies.length > 0 ? (
                      <div className="max-w-52 text-right">
                        <span className="text-[9px] uppercase text-rose-300 font-bold block">Allergies</span>
                        <span className="text-[11px] font-bold text-white bg-rose-600 px-2 py-0.5 rounded inline-block truncate max-w-full">
                          {activePatient.allergies.join(', ')}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-400">No known allergies</span>
                    )}
                  </div>

                  {/* Prescription transaction grid */}
                  <div className="min-h-0 flex-1 overflow-hidden flex flex-col">
                    <div className="shrink-0 px-3 py-2 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
                      <h4 className="text-xs font-bold uppercase text-slate-800">Doctor's Prescription ({allPrescriptions.length} items)</h4>
                      <span className="text-[10px] font-mono text-slate-500">{clinicMeds.length} clinic · {allPrescriptions.length - clinicMeds.length} outside</span>
                    </div>
                    <div className="min-h-0 flex-1 overflow-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 z-10 bg-slate-100 border-b border-slate-200 text-[10px] uppercase font-bold text-slate-600">
                          <tr>
                            <th className="px-3 py-2">Medicine / Prescription</th>
                            <th className="px-3 py-2 text-center">Dose</th>
                            <th className="px-3 py-2 text-center">Qty</th>
                            <th className="px-3 py-2">FEFO Batch / Stock</th>
                            <th className="px-3 py-2 text-right">Rate</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="w-28 px-3 py-2 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allPrescriptions.map((medicine, index) => {
                            const catalogDrug = drugs.find((drug) => drug.id === medicine.drugId || drug.name === medicine.drugName);
                            const isOutside = Boolean(medicine.isOutsideMedicine);
                            const isDispensed = Boolean(medicine.dispensed);
                            const activeBatches = isOutside ? [] : batches
                              .filter((batch) => (batch.drugId === medicine.drugId || batch.drugName === medicine.drugName) && batch.status === 'active' && batch.quantity > 0)
                              .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
                            const earliestBatch = activeBatches[0];
                            const totalAvailableStock = activeBatches.reduce((sum, batch) => sum + batch.quantity, 0);
                            const daysLeft = earliestBatch ? getDaysUntilExpiry(earliestBatch.expiryDate) : null;
                            const isExpired = daysLeft !== null && daysLeft <= 0;
                            const allergyClass = catalogDrug?.allergyClass;
                            const hasAllergyConflict = !isOutside && activePatient.allergies.length > 0 && Boolean(allergyClass) && activePatient.allergies.some((allergy) =>
                              allergyClass!.toLowerCase().includes(allergy.toLowerCase()) || allergy.toLowerCase().includes(allergyClass!.toLowerCase())
                            );
                            const qty = isDispensed ? medicine.qtyDispensed || 0 : dispenseQtys[index] !== undefined ? dispenseQtys[index] : medicine.qtyToDispense || 10;
                            return (
                              <tr key={index} className={isOutside ? 'bg-indigo-50/25' : isDispensed ? 'bg-emerald-50/30' : 'bg-white hover:bg-slate-50'}>
                                <td className="px-3 py-2.5 align-top">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-sm text-slate-900">{medicine.drugName}</span>
                                    {isOutside && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">Outside</span>}
                                    {hasAllergyConflict && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">Allergy conflict</span>}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">{medicine.form} · {medicine.strength} · {medicine.frequency}</div>
                                  {medicine.instructions && <div className="text-[10px] text-slate-500 italic mt-0.5">{medicine.instructions}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-center align-top">
                                  <div className="font-mono font-bold text-slate-900">{medicine.dose}</div>
                                  {medicine.duration && <div className="text-[10px] text-slate-500">{medicine.duration}</div>}
                                </td>
                                <td className="px-3 py-2.5 text-center align-top">
                                  {!isOutside && !isDispensed ? (
                                    <input
                                      aria-label={`Quantity for ${medicine.drugName}`}
                                      type="number"
                                      min="1"
                                      max={totalAvailableStock || 100}
                                      value={qty}
                                      onChange={(event) => setDispenseQtys({ ...dispenseQtys, [index]: Math.max(1, parseInt(event.target.value, 10) || 1) })}
                                      className="w-16 px-2 py-1.5 border border-slate-300 rounded-md text-center font-bold font-mono"
                                    />
                                  ) : <span className="font-bold font-mono">{qty}</span>}
                                </td>
                                <td className="px-3 py-2.5 align-top">
                                  {isOutside ? (
                                    <span className="text-indigo-700 text-[11px]">Not stocked by clinic</span>
                                  ) : earliestBatch ? (
                                    <>
                                      <div className="font-mono font-bold text-slate-800">{earliestBatch.batchNumber}</div>
                                      <div className={`text-[10px] ${isExpired ? 'text-rose-700 font-bold' : daysLeft !== null && daysLeft <= 30 ? 'text-amber-700 font-bold' : 'text-slate-500'}`}>
                                        Stock {totalAvailableStock} · Exp {earliestBatch.expiryDate}
                                      </div>
                                    </>
                                  ) : (
                                    <span className="text-[11px] font-bold text-rose-700">Out of stock</span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right align-top font-mono">{isOutside ? '-' : `₹${medicine.unitPrice || 0}`}</td>
                                <td className="px-3 py-2.5 text-right align-top font-bold font-mono">{isOutside ? '-' : `₹${((medicine.unitPrice || 0) * qty).toFixed(2)}`}</td>
                                <td className="px-3 py-2.5 text-center align-top">
                                  {isOutside ? (
                                    <span className="text-[10px] text-indigo-600">Purchased outside</span>
                                  ) : isDispensed ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px]">
                                      <CheckCircle2 className="w-3.5 h-3.5" /> Dispensed
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={!earliestBatch || isExpired || totalAvailableStock <= 0}
                                      onClick={() => handleDispenseItem(index, medicine)}
                                      className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-md inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <Package className="w-3.5 h-3.5" /> Dispense
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                          {allPrescriptions.length === 0 && (
                            <tr><td colSpan={7} className="h-28 text-center text-slate-400 italic">No medicines prescribed for this visit.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Billing footer */}
                  <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
                    {dispensedMeds.length === 0 ? (
                      <div className="h-14 flex items-center justify-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg">
                        Dispense at least one clinic medicine to enable billing.
                      </div>
                    ) : (
                      <form onSubmit={handleGeneratePharmacyBill} className="grid grid-cols-[auto_minmax(210px,1fr)_auto_auto] gap-3 items-end">
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">Items</div>
                          <div className="h-9 px-3 flex items-center rounded-lg border border-slate-200 bg-white font-bold text-slate-700">{dispensedMeds.length}</div>
                        </div>
                        <div>
                          <div className="text-[9px] uppercase font-bold text-slate-500 mb-1">Payment</div>
                          <div className="grid grid-cols-[repeat(3,minmax(58px,1fr))_minmax(110px,1fr)] gap-2">
                            <button type="button" onClick={() => setPaymentMethod('cash')} className={`h-9 px-2 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${paymentMethod === 'cash' ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'}`}><Banknote className="w-4 h-4" /> Cash</button>
                            <button type="button" onClick={() => setPaymentMethod('upi')} className={`h-9 px-2 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${paymentMethod === 'upi' ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'}`}><QrCode className="w-4 h-4" /> UPI</button>
                            <button type="button" onClick={() => setPaymentMethod('card')} className={`h-9 px-2 rounded-lg border text-xs font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${paymentMethod === 'card' ? 'border-teal-600 bg-teal-50 text-teal-900' : 'border-slate-300 bg-white text-slate-700'}`}><CreditCard className="w-4 h-4" /> Card</button>
                            {paymentMethod === 'upi' ? (
                              <input value={upiRef} onChange={(event) => setUpiRef(event.target.value)} placeholder="UPI reference *" className="h-9 px-2 border border-blue-300 rounded-lg text-xs bg-white" />
                            ) : <div className="h-9" />}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] uppercase font-bold text-slate-500">Net Payable</div>
                          <div className="text-xl font-black font-mono text-teal-800">₹{billableTotal.toFixed(2)}</div>
                        </div>
                        <div className="flex items-end gap-2">
                          <button
                            type="button"
                            onClick={() => showConfirm({
                              title: 'Cancel Pharmacy Bill?',
                              message: `Cancel dispensing for ${dispensedMeds.length} medicine${dispensedMeds.length === 1 ? '' : 's'} and return the dispensed quantity to stock?`,
                              confirmLabel: 'Cancel Bill & Restore Stock',
                              isDestructive: true,
                              onConfirm: () => cancelPharmacyDispensing(activeVisit.id),
                            })}
                            className="h-10 px-3 border border-rose-300 text-rose-700 bg-white hover:bg-rose-50 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            Cancel Bill
                          </button>
                          <button type="submit" className="h-10 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs">
                            <Printer className="w-4 h-4" /> Collect & Bill
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* RETAIL PHARMACY POS */}
      {activeTab === 'retail' && (
        <div className="min-h-0 flex-1 overflow-hidden flex flex-col gap-3">
          {/* Patient / customer information header */}
          <div className="shrink-0 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-xs grid grid-cols-1 md:grid-cols-[1.25fr_.75fr_.75fr_.75fr] gap-3 items-end">
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Customer / Patient</label>
              <select value={retailPatientId} onChange={(e) => setRetailPatientId(e.target.value)} className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm bg-white">
                <option value="">Walk-in customer</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.mrn})</option>)}
              </select>
            </div>
            {!retailPatientId ? (
              <>
                <div><label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Mobile *</label><input value={retailPhone} onChange={(e) => setRetailPhone(e.target.value)} placeholder="Mobile number" className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm" /></div>
                <div><label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Customer Name</label><input value={retailName} onChange={(e) => setRetailName(e.target.value)} placeholder="Optional" className="w-full h-10 px-3 border border-slate-300 rounded-lg text-sm" /></div>
              </>
            ) : (
              <div className="md:col-span-2"><label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Registered Customer</label><div className="h-10 px-3 flex items-center border border-teal-200 bg-teal-50 rounded-lg text-sm font-bold text-teal-800">{patients.find((p) => p.id === retailPatientId)?.name}</div></div>
            )}
            <div>
              <label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Transaction</label>
              <div className="h-10 px-3 flex items-center justify-between border border-slate-200 bg-slate-50 rounded-lg text-xs"><span className="text-slate-500">New Sale</span><span className="font-mono font-bold text-slate-700">#{String(retailCart.length + 1).padStart(3, '0')}</span></div>
            </div>
          </div>

          {/* Item entry and transaction grid */}
          <div className="min-h-0 flex-1 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
            <div className="shrink-0 p-3 border-b border-slate-200 bg-slate-50/70 relative space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input value={retailSearch} onChange={(e) => setRetailSearch(e.target.value)} autoComplete="off" placeholder="Scan QR/barcode or search medicine by name, strength or generic name..." className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500" />
                  {retailPredictions.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl">
                    {retailPredictions.map((drug) => {
                      const stock = batches.filter((b) => b.drugId === drug.id && !b.isWrittenOff).reduce((sum, b) => sum + b.quantity, 0);
                      return (
                        <button key={drug.id} onClick={() => addRetailDrug(drug.id)} className="w-full px-4 py-2.5 text-left hover:bg-teal-50 border-b border-slate-100 last:border-0 flex items-center justify-between cursor-pointer">
                          <span><span className="font-bold text-sm text-slate-900">{drug.name} {drug.strength}</span><span className="block text-[11px] text-slate-500">{drug.form} · {drug.genericName}</span></span>
                          <span className="text-right"><span className="block text-xs font-bold text-teal-700">₹{drug.unitPrice}</span><span className={`text-[11px] ${stock <= drug.reorderLevel ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>Stock: {stock}</span></span>
                        </button>
                      );
                    })}
                  </div>
                )}
                </div>
                <button
                  type="button"
                  onClick={retailScannerOpen ? stopRetailScanner : startRetailScanner}
                  className={`h-10 shrink-0 px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ${retailScannerOpen ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-teal-300 bg-teal-50 text-teal-800'}`}
                >
                  {retailScannerOpen ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
                  {retailScannerOpen ? 'Close' : 'Scan Item'}
                </button>
              </div>
              {retailScannerOpen && (
                <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-950 max-h-52">
                  <video ref={retailScannerVideoRef} muted playsInline className="block w-full h-44 object-contain" />
                  <div className="px-3 py-1.5 text-center text-[11px] text-white bg-slate-900">Position the medicine QR or barcode in the camera view</div>
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-auto">
              <table className="w-full text-xs text-left">
                <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 uppercase font-semibold border-b border-slate-200">
                  <tr><th className="w-10 px-3 py-2.5 text-center">#</th><th className="px-3 py-2.5">Medicine / Batch</th><th className="px-3 py-2.5 text-center">Qty</th><th className="px-3 py-2.5">Dose</th><th className="px-3 py-2.5 text-center">Days</th><th className="px-3 py-2.5 text-right">Rate</th><th className="px-3 py-2.5 text-right">Amount</th><th className="w-12 px-3 py-2.5"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {retailCart.map((item, index) => {
                    const drug = drugs.find((d) => d.id === item.drugId);
                    const stock = batches.filter((b) => b.drugId === item.drugId && !b.isWrittenOff).reduce((sum, b) => sum + b.quantity, 0);
                    const validStock = Math.max(1, stock);
                    return (
                      <tr key={item.drugId} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-center font-mono text-slate-400">{index + 1}</td>
                        <td className="px-3 py-2.5"><div className="font-bold text-sm text-slate-900">{drug?.name} {drug?.strength}</div><div className="text-[10px] text-slate-500">{drug?.form} · Stock {stock}</div></td>
                        <td className="px-3 py-2.5"><input aria-label="Quantity" type="number" min="1" max={validStock} value={item.qty} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, qty: Math.min(validStock, Math.max(1, Number(e.target.value) || 1)) } : it))} className="w-16 mx-auto block px-2 py-1.5 border border-slate-300 rounded-md text-center font-bold" /></td>
                        <td className="px-3 py-2.5"><input aria-label="Dosage" value={item.dosage} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, dosage: e.target.value.replace(/[^0-9-]/g, '') } : it))} placeholder="1-0-1" className="w-24 px-2 py-1.5 border border-slate-300 rounded-md font-mono" /></td>
                        <td className="px-3 py-2.5"><input aria-label="Days" type="number" min="1" value={item.days} onChange={(e) => setRetailCart((items) => items.map((it, i) => i === index ? { ...it, days: Math.max(1, Number(e.target.value) || 1) } : it))} className="w-16 mx-auto block px-2 py-1.5 border border-slate-300 rounded-md text-center" /></td>
                        <td className="px-3 py-2.5 text-right font-mono">₹{drug?.unitPrice}</td>
                        <td className="px-3 py-2.5 text-right font-bold font-mono">₹{((drug?.unitPrice || 0) * item.qty).toFixed(2)}</td>
                        <td className="px-2 py-2.5"><button onClick={() => setRetailCart((items) => items.filter((_, i) => i !== index))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer" title="Remove item"><Trash2 className="w-4 h-4" /></button></td>
                      </tr>
                    );
                  })}
                  {!retailCart.length && (
                    <tr><td colSpan={8} className="h-36 text-center"><Package className="w-7 h-7 mx-auto text-slate-300 mb-2" /><span className="text-sm text-slate-400">Search or scan medicine to add the first item</span></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial summary footer */}
          <div className="shrink-0 grid grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1.5fr] gap-px bg-slate-200 border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-white px-4 py-2"><span className="text-[10px] uppercase font-bold text-slate-500 block">Subtotal</span><span className="font-mono font-bold text-slate-800">₹{retailTotal.toFixed(2)}</span></div>
            <div className="bg-white px-4 py-2"><span className="text-[10px] uppercase font-bold text-slate-500 block">Discount</span><span className="font-mono font-bold text-slate-800">₹0.00</span></div>
            <div className="bg-white px-4 py-2"><span className="text-[10px] uppercase font-bold text-slate-500 block">Tax (GST 0%)</span><span className="font-mono font-bold text-slate-800">₹0.00</span></div>
            <div className="bg-white px-4 py-2"><span className="text-[10px] uppercase font-bold text-slate-500 block">Balance Due</span><span className="font-mono font-bold text-slate-800">₹{retailTotal.toFixed(2)}</span></div>
            <div className="bg-teal-700 text-white px-4 py-2 lg:col-span-1 col-span-2 flex items-center justify-between"><span className="text-xs uppercase font-bold">Net Payable</span><span className="text-2xl font-black font-mono">₹{retailTotal.toFixed(2)}</span></div>
          </div>

          {/* Bottom action toolbar */}
          <div className="shrink-0 bg-white border border-slate-200 rounded-xl p-2 shadow-xs flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {(['cash', 'upi', 'card'] as PaymentMethod[]).map((method) => (
                <button key={method} onClick={() => setRetailPayment(method)} className={`h-9 px-4 border rounded-lg text-xs font-bold capitalize cursor-pointer ${retailPayment === method ? 'border-teal-600 bg-teal-50 text-teal-700 ring-1 ring-teal-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{method}</button>
              ))}
              {retailPayment === 'upi' && <input value={retailUpiRef} onChange={(e) => setRetailUpiRef(e.target.value)} placeholder="UPI reference *" className="h-9 w-40 px-3 border border-slate-300 rounded-lg text-xs" />}
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => { setRetailCart([]); setRetailSearch(''); setRetailName(''); setRetailPhone(''); setRetailPatientId(''); setRetailUpiRef(''); }} disabled={!retailCart.length && !retailName && !retailPhone} className="h-9 px-4 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 disabled:opacity-40 cursor-pointer">Clear</button>
              <button onClick={billRetail} disabled={!retailCart.length} className="h-9 px-5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer"><Printer className="w-4 h-4" />Generate Bill & Print</button>
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
                          <div className="flex justify-end gap-2">
                            {!isVoided && bill.items.some((item) => (item.returnedQty || 0) < item.qty) && (
                              <button
                                type="button"
                                onClick={() => { setReturnBill(bill); setReturnQuantities({}); setReturnReason(''); setReturnRefundMethod(bill.paymentMethod); }}
                                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded flex items-center gap-1 cursor-pointer"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                <span>Return</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setActiveReceiptBill(bill)}
                              className="px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>Receipt</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {returnBill && (
            <div className="fixed inset-0 z-50 bg-slate-950/40 flex items-center justify-center p-4" onClick={() => setReturnBill(null)}>
              <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden" onClick={(event) => event.stopPropagation()}>
                <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
                  <div><div className="font-bold">Process Medicine Return</div><div className="text-xs text-slate-300 font-mono">{returnBill.invoiceNo} · {returnBill.patientName}</div></div>
                  <button type="button" onClick={() => setReturnBill(null)} className="p-1.5 rounded hover:bg-white/10 cursor-pointer"><X className="w-4 h-4" /></button>
                </div>
                <div className="p-4 space-y-3">
                  <div className="max-h-72 overflow-auto border border-slate-200 rounded-lg divide-y">
                    {returnBill.items.map((item, itemIndex) => {
                      const available = item.qty - (item.returnedQty || 0);
                      return (
                        <div key={itemIndex} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3 items-center px-3 py-2.5">
                          <div><div className="font-bold text-sm text-slate-900">{item.name}</div><div className="text-[11px] text-slate-500">Purchased {item.qty} · Returned {item.returnedQty || 0}</div></div>
                          <div className="font-mono font-bold text-slate-800">₹{item.unitPrice}</div>
                          <input aria-label={`Return quantity for ${item.name}`} type="number" min="0" max={available} disabled={available <= 0} value={returnQuantities[itemIndex] || 0} onChange={(event) => setReturnQuantities((current) => ({ ...current, [itemIndex]: Math.min(available, Math.max(0, parseInt(event.target.value, 10) || 0)) }))} className="w-16 px-2 py-1.5 border border-slate-300 rounded text-center font-mono disabled:bg-slate-100" />
                        </div>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Return Reason *</label><input value={returnReason} onChange={(event) => setReturnReason(event.target.value)} placeholder="Customer requested return" className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm" /></div>
                    <div><label className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Refund Method</label><select value={returnRefundMethod} onChange={(event) => setReturnRefundMethod(event.target.value as PaymentMethod)} className="w-full h-9 px-3 border border-slate-300 rounded-lg text-sm bg-white"><option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option></select></div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                    <div className="text-xs text-slate-500">Refund will be calculated from returned quantities.</div>
                    <button type="button" onClick={async () => {
                      const selected = returnBill.items.map((_, itemIndex) => ({ itemIndex, qty: returnQuantities[itemIndex] || 0 })).filter((item) => item.qty > 0);
                      if (!selected.length) { showToast('warning', 'Enter quantity for at least one medicine.'); return; }
                      if (!returnReason.trim()) { showToast('warning', 'Enter the return reason.'); return; }
                      const ok = await returnPharmacyItems({ billId: returnBill.id, items: selected, reason: returnReason, refundMethod: returnRefundMethod });
                      if (ok) { setReturnBill(null); setReturnQuantities({}); setReturnReason(''); }
                    }} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer">Confirm Return & Refund</button>
                  </div>
                </div>
              </div>
            </div>
          )}
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
          <div className="pb-3 border-b border-slate-200 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-teal-800 font-bold text-base">
                <PlusCircle className="w-5 h-5 text-teal-600" />
                <span>Drug Stock-In Form</span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Receive a new drug batch. Strict Safety Rule: Expiry date must be at least 30 days in the future from today ({CLINIC_CURRENT_DATE}).
              </p>
            </div>
            <button
              type="button"
              onClick={scannerOpen ? stopStockScanner : startStockScanner}
              className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer border ${scannerOpen ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-teal-300 bg-teal-50 text-teal-800'}`}
            >
              {scannerOpen ? <X className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              {scannerOpen ? 'Close Scanner' : 'Scan QR Code'}
            </button>
          </div>

          {scannerOpen && (
            <div className="overflow-hidden rounded-xl border border-slate-300 bg-slate-950">
              <video ref={stockScannerVideoRef} muted playsInline className="block w-full max-h-72 object-contain" />
              <div className="px-3 py-2 text-center text-[11px] font-medium text-white bg-slate-900">
                {scannerStatus || 'Looking for a QR code...'}
              </div>
            </div>
          )}

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
