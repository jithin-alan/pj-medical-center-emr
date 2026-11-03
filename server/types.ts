export type Role = 'receptionist' | 'doctor' | 'nurse' | 'pharmacist' | 'laboratory' | 'accounts' | 'tv' | 'admin';

export type DoctorId = 'doc-1' | 'doc-2' | 'doc-3';

export interface Doctor {
  id: DoctorId;
  name: string;
  specialty: string;
  qualification: string;
  registrationNumber: string;
  tokenPrefix: string;
  consultationFee: number;
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

export type ShiftType = 'Shift A' | 'Shift B';

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
}

export interface Patient {
  id: string;
  mrn: string; // Permanent MRN e.g. PJ-000001
  name: string;
  age: number;
  sex: 'Male' | 'Female' | 'Other';
  phone: string; // +91 format
  allergies: string[];
  registeredAt: string;
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
}

export interface CaseSheet {
  chiefComplaint: string;
  history: string;
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
  allergyClass?: string | null; // e.g. 'Penicillins', 'NSAIDs / Aspirin', 'Fluoroquinolones', 'Sulphonamides', etc.
  contraindicatedAllergies?: string[];
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
  tokenNumber: string;
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
}

export interface BillItem {
  name: string;
  qty: number;
  unitPrice: number;
  total: number;
  dose?: string;
  duration?: string;
}

export interface Bill {
  id: string;
  invoiceNo: string; // e.g. REC-2026-0001, PHM-2026-0001
  type: 'consultation' | 'procedure' | 'pharmacy' | 'lab';
  visitId: string;
  patientId: string;
  patientName: string;
  patientMrn: string;
  items: BillItem[];
  subtotal: number;
  tax: number; // 0 for clinical services
  total: number;
  paymentMethod: PaymentMethod;
  upiRef?: string;
  cashierName: string;
  shift: ShiftType;
  timestamp: string;
  status: 'paid' | 'voided';
  voidReason?: string;
  voidApprovedBy?: string;
  voidTimestamp?: string;
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
  doctorId: DoctorId; // Per-doctor template scoping!
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
