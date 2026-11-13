/**
 * Types and data models for PJ Medical Clinic Management System
 */

export type Role = 'receptionist' | 'doctor' | 'nurse' | 'pharmacist' | 'laboratory' | 'accounts' | 'tv' | 'admin' | 'audit';

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  modules: Role[];
  active: boolean;
  shift?: ShiftType;
  createdAt: string;
  updatedAt: string;
}

export type DoctorId = 'doc-1' | 'doc-2' | 'doc-3';

export interface Doctor {
  id: DoctorId;
  name: string;
  specialty: string;
  qualification: string;
  registrationNumber: string;
  tokenPrefix: string;
  consultationFee: number;
  shift?: ShiftType;
  startTime?: string;
  endTime?: string;
  workingDays?: string[];
  roomId?: string;
}

export interface Room {
  id: string;
  name: string;
  occupiedByDoctorId: DoctorId | null;
  occupiedByDoctorName: string | null;
  currentTokenNumber: string | null;
  occupiedAt: string | null;
}

export type PaymentMethod = 'cash' | 'upi' | 'card';

export type ShiftType = 'Shift A' | 'Shift B' | 'Shift C';

export interface ShiftRecord {
  id: string;
  department: 'reception' | 'pharmacy';
  shiftType: ShiftType;
  cashierName: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingActualCash?: number;
  calculatedCash?: number;
  calculatedUpi?: number;
  calculatedCard?: number;
  totalBillsCount?: number;
  refundsCount?: number;
  refundsTotal?: number;
  difference?: number;
  handedOverTo?: string;
  handoverNotes?: string;
  handedOverAt?: string;
  openedByUserId?: string;
  closedByUserId?: string;
}

export interface Patient {
  id: string;
  mrn: string; // Permanent Medical Record Number, e.g. PJ-000001
  name: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  phone: string; // +91 format
  allergies: string[];
  pastHistory: string; // Patient-level chronic history carried across all consultations
  registeredAt: string;
  discount?: PatientDiscount;
  followUpUntil?: string; // YYYY-MM-DD until which follow-up visits are free
  lastConsultationDate?: string; // YYYY-MM-DD of most recent paid consultation
}

export interface PatientDiscount {
  type: 'percentage' | 'fixed';
  value: number;
  reason: string;
  grantedBy: string;
  grantedAt: string;
  remainingUses: number;
}

export type PatientStage =
  | 'registered_token_paid'       // 1. Registered + token paid
  | 'waiting_doctor'              // 2. Waiting for doctor
  | 'with_doctor'                 // 3. With doctor
  | 'procedure_billing_pending'   // 4. Procedure billing pending
  | 'nurse_check_pending'         // 5. Nurse check pending
  | 'procedures_done'             // 6. Procedures done
  | 'waiting_pharmacy'            // 7. Waiting for pharmacy
  | 'completed';                  // 8. Completed

export interface StageEvent {
  stage: PatientStage;
  timestamp: string;
  actorName: string;
  actorRole: string;
  notes?: string;
}

export interface Vitals {
  bp: string;      // e.g. 120/80 mmHg
  pulse: string;   // e.g. 76 bpm
  temp: string;    // e.g. 98.6 °F
  spo2: string;    // e.g. 99%
  weight: string;  // e.g. 68 kg
  respiratoryRate: string; // e.g. 16 /min
}

export interface CaseSheet {
  chiefComplaint: string;
  history: string;
  pastHistory: string;
  vitals: Vitals;
  examination: string;
  diagnosis: string;
  plan: string;
  allergyReasonOverride?: string;
  savedAt?: string;
}

export interface DrugBatch {
  id: string;
  drugId: string;
  drugName?: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number;
  purchasePrice: number;
  supplier: string;
  dateReceived: string;
  status?: 'active' | 'depleted' | 'expired' | 'written_off';
  isWrittenOff?: boolean;
  writeOffReason?: string;
  writeOffDate?: string;
  writeOffQuantity?: number;
  writeOffValue?: number;
}

export interface DrugItem {
  id: string;
  name: string;
  genericName: string;
  strength: string;
  form: 'Tablet' | 'Capsule' | 'Syrup' | 'Injection' | 'Inhaler' | 'Ointment' | 'Sachet' | 'Drops';
  unitPrice: number;
  reorderLevel: number;
  allergyClass?: string | null;
  contraindicatedAllergies?: string[];
  stockQty?: number;
  earliestBatchNumber?: string | null;
  earliestExpiryDate?: string | null;
  isNearExpiry?: boolean;
}

export interface PrescribedMedicine {
  drugId?: string;
  drugName: string;
  strength: string;
  form: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
  isOutsideMedicine: boolean;
  unitPrice: number;
  qtyToDispense: number;
  qtyDispensed: number;
  dispensed: boolean;
  dispensedAt?: string;
  dispensedBy?: string;
  dispensedBatchNumber?: string;
  dispensedBatchExpiry?: string;
  allergyWarningIgnored?: boolean;
  allergyWarningReason?: string;
}

export interface LabTestCatalogueItem {
  id: string;
  name: string;
  category: 'Haematology' | 'Biochemistry' | 'Microbiology' | 'Serology' | 'Radiology';
  price: number;
  sample?: string;
  turnaround?: string;
}

export type LabOrderStatus = 'UNBILLED' | 'BILLED' | 'COLLECTED' | 'REPORTED';

export interface PrescribedLabTest {
  labTestId: string;
  name: string;
  unitPrice: number;
  qty: number;
  totalPrice: number;
  notes?: string;
  status: LabOrderStatus;
  billInvoiceNo?: string;
  billed: boolean;
  collected: boolean;
  reported: boolean;
  resultSummary?: string;
  resultAttachment?: string;
  reportedAt?: string;
  reportedBy?: string;
}

export interface ProcedureCatalogueItem {
  id: string;
  name: string;
  category: 'Injection' | 'IV Fluid' | 'Procedure' | 'Diagnostics' | 'Dressing';
  price: number;
  description: string;
}

export type ProcedureOrderStatus = 'UNBILLED' | 'BILLED' | 'GIVEN';

export interface PrescribedProcedure {
  procedureId: string;
  name: string;
  unitPrice: number;
  qty: number;
  totalPrice: number;
  notes?: string;
  status: ProcedureOrderStatus; // SINGLE SOURCE OF TRUTH: 'UNBILLED' -> 'BILLED' -> 'GIVEN'
  billInvoiceNo?: string;
  billed: boolean;
  nurseGiven: boolean;
  nurseGivenAt?: string;
  nurseName?: string;
  nurseNote?: string;
}

export interface TokenVisit {
  id: string;
  tokenNumber: string; // e.g. D1-001, D2-002, D3-001
  patientId: string;
  doctorId: DoctorId;
  reason: string;
  fee: number;
  paymentMethod: PaymentMethod;
  upiRef?: string;
  cashierName: string;
  shift: ShiftType;
  timestamp: string;
  status: PatientStage;
  assignedRoom?: string;
  calledAt?: string;
  completedAt?: string;
  stageHistory: StageEvent[];
  caseSheet?: CaseSheet;
  prescriptions: PrescribedMedicine[];
  procedureOrders: PrescribedProcedure[];
  labOrders?: PrescribedLabTest[];
  consultationReceiptNo: string;
  procedureBillId?: string;
  pharmacyBillId?: string;
  printCount?: number;
  lastPrintedAt?: string;
  isFollowUp?: boolean; // true when visit is a free follow-up within the 2-week window
  followUpFreeUntil?: string; // YYYY-MM-DD copied from the patient's follow-up window
}

export interface BillItem {
  drugId?: string;
  name: string;
  description?: string;
  serviceCode?: string;
  qty: number;
  unit?: string;
  unitPrice: number;
  discountAmount?: number;
  subtotal?: number;
  total: number;
  dose?: string;
  duration?: string;
  returnedQty?: number;
}

export interface DocumentCounter {
  series: string;
  financialYear: string;
  locationCode: string;
  counterCode?: string;
  lastSequence: number;
}

export interface PaymentAllocation {
  method: PaymentMethod | 'bank_transfer' | 'credit' | 'wallet';
  amount: number;
  reference?: string;
  receivedAt: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
}

export interface RefundRecord {
  id: string;
  refundNo: string;
  type: 'full' | 'partial';
  items: { itemIndex: number; qty: number; amount: number }[];
  amount: number;
  reason: string;
  method: PaymentMethod;
  status: 'pending' | 'completed' | 'rejected';
  idempotencyKey?: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
}

export interface DocumentAmendment {
  id: string;
  type: 'void' | 'cancel' | 'credit_note';
  reason: string;
  amount: number;
  originalInvoiceId: string;
  originalInvoiceNo: string;
  createdByUserId: string;
  createdByName: string;
  approvedByUserId: string;
  approvedByName: string;
  timestamp: string;
}

export interface Bill {
  id: string;
  invoiceNo: string; // e.g. REC-2026-0001, PHM-2026-0001
  type: 'consultation' | 'procedure' | 'pharmacy' | 'lab';
  documentSeries?: string;
  documentNumberSequence?: number;
  financialYear?: string;
  locationCode?: string;
  counterCode?: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  patientSnapshot?: {
    name: string;
    mrn: string;
    phone?: string;
    address?: string;
  };
  doctorId?: DoctorId;
  doctorName?: string;
  department?: string;
  items: BillItem[];
  subtotal: number;
  discountAmount?: number;
  discountReason?: string;
  tax: number;
  roundingAmount?: number;
  total: number;
  amountPaid?: number;
  balanceDue?: number;
  currency?: 'INR';
  paymentMethod: PaymentMethod;
  paymentAllocations?: PaymentAllocation[];
  upiRef?: string;
  cashierUserId?: string;
  cashierName: string;
  shift: ShiftType;
  shiftId?: string;
  timestamp: string;
  finalizedAt?: string;
  status: 'draft' | 'finalized' | 'paid' | 'partially_paid' | 'refunded' | 'partially_refunded' | 'voided' | 'cancelled';
  amendments?: DocumentAmendment[];
  refunds?: RefundRecord[];
  voidReason?: string;
  voidApprovedBy?: string;
  voidTimestamp?: string;
  cancellationRequest?: {
    status: 'pending';
    reason: string;
    requestedByUserId: string;
    requestedByName: string;
    requestedAt: string;
  };
  stockDeductions?: { drugId: string; drugName: string; batchId?: string; batchNumber: string; qty: number }[];
  returnedAt?: string;
  returnedAmount?: number;
  printCount?: number;
  lastPrintedAt?: string;
}

export interface PatientLedgerEntry {
  id: string;
  patientId: string;
  patientMrn: string;
  visitId?: string;
  invoiceId?: string;
  invoiceNo?: string;
  type: 'charge' | 'payment' | 'advance' | 'refund' | 'credit' | 'adjustment' | 'void';
  description: string;
  debit: number;
  credit: number;
  runningBalance: number;
  timestamp: string;
  reference?: string;
}

export interface PaymentLedgerEntry {
  id: string;
  invoiceId?: string;
  invoiceNo?: string;
  patientId: string;
  patientMrn: string;
  visitId?: string;
  type: 'payment' | 'advance' | 'refund' | 'reversal';
  method: PaymentMethod;
  amount: number;
  transactionReference?: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  shiftId?: string;
  shift: ShiftType;
  cashierUserId?: string;
  cashierName: string;
  counterCode?: string;
  timestamp: string;
}

export interface ReceiptDocument {
  id: string;
  receiptNo: string;
  invoiceId: string;
  invoiceNo: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  visitId?: string;
  amountReceived: number;
  balanceDue: number;
  currency: 'INR';
  payments: PaymentAllocation[];
  cashierUserId?: string;
  cashierName: string;
  counterCode?: string;
  shiftId?: string;
  shift: ShiftType;
  timestamp: string;
  reprintCount?: number;
  lastReprintedAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  role: string;
  userName: string;
  userRole?: string;
  userId?: string;
  action: string;
  targetEntity: string;
  patientMrn?: string;
  beforeValue?: any;
  afterValue?: any;
  details: string;
}

export interface ClinicalTemplate {
  id: string;
  doctorId: DoctorId;
  name: string;
  chiefComplaint: string;
  history: string;
  examination: string;
  diagnosis: string;
  plan: string;
  suggestedMeds?: Array<Partial<PrescribedMedicine>>;
  suggestedProcedures?: Array<{ procedureId: string; qty: number; notes?: string }>;
}

export interface ClinicSettings {
  clinicName: string;
  address: string;
  phone: string;
  regNumber: string;
  gstNote: string;
}
