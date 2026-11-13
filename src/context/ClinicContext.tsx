import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  Doctor,
  Room,
  DrugItem,
  DrugBatch,
  ProcedureCatalogueItem,
  LabTestCatalogueItem,
  PrescribedLabTest,
  Patient,
  TokenVisit,
  Bill,
  PatientLedgerEntry,
  PaymentLedgerEntry,
  ShiftRecord,
  AuditLog,
  ClinicSettings,
  DoctorId,
  Role,
  PaymentMethod,
  ShiftType,
  CaseSheet,
  PrescribedMedicine,
  PrescribedProcedure,
  ClinicalTemplate,
  StaffAccount,
} from '../types';
import { playClinicChime } from '../utils/audioChime';
import { ToastContainer, ToastMessage } from '../components/Toast';
import { ConfirmDialog, ConfirmDialogOptions } from '../components/ConfirmDialog';
import { INITIAL_STAFF_ACCOUNTS } from '../data/initialData';

// Staff accounts for offline/demo login mode
const FALLBACK_STAFF_ACCOUNTS: StaffAccount[] = INITIAL_STAFF_ACCOUNTS;

interface ClinicContextType {
  role: Role;
  setRole: (role: Role) => void;
  userName: string;
  setUserName: (name: string) => void;
  isAuthenticated: boolean;
  login: (staff: StaffAccount) => void;
  logout: () => void;
  settings: ClinicSettings;
  staffAccounts: StaffAccount[];
  fallbackStaffAccounts: StaffAccount[];
  doctors: Doctor[];
  rooms: Room[];
  drugs: DrugItem[];
  batches: DrugBatch[];
  procedures: ProcedureCatalogueItem[];
  labTests: LabTestCatalogueItem[];
  templates: ClinicalTemplate[];
  patients: Patient[];
  visits: TokenVisit[];
  bills: Bill[];
  patientLedger: PatientLedgerEntry[];
  paymentLedger: PaymentLedgerEntry[];
  shifts: ShiftRecord[];
  auditLogs: AuditLog[];
  currentDoctorId: DoctorId;
  setCurrentDoctorId: (id: DoctorId) => void;
  isConnected: boolean;
  currentUser: { name: string; role: Role };
  latestCalledToken: { tokenNumber: string; room: string; doctorName: string } | null;

  // Modals & Sheets
  activeReceiptBill: Bill | null;
  setActiveReceiptBill: (bill: Bill | null) => void;
  activePrescriptionPrintVisit: TokenVisit | null;
  setActivePrescriptionPrintVisit: (v: TokenVisit | null) => void;
  activeHistoryPatient: Patient | null;
  setActiveHistoryPatient: (p: Patient | null) => void;

  // Toast & Confirm System (Safety Fix 1)
  showToast: (type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => void;
  showConfirm: (options: ConfirmDialogOptions) => void;

  // Actions
  registerPatient: (patientData: {
    name: string;
    age: number;
    sex: 'Male' | 'Female' | 'Other';
    phone: string;
    allergies: string[];
  }) => Promise<Patient | null>;
  updatePatientAllergies: (patientId: string, allergies: string[]) => Promise<boolean>;
  updatePatientPastHistory: (patientId: string, pastHistory: string) => Promise<boolean>;
  updatePatientDiscount: (patientId: string, discount: { type: 'percentage' | 'fixed'; value: number; reason: string }) => Promise<boolean>;
  createTokenVisit: (data: {
    patientId: string;
    doctorId: DoctorId;
    reason: string;
    paymentMethod: PaymentMethod;
    upiRef?: string;
  }) => Promise<{ visit: TokenVisit; bill: Bill } | null>;
  callNextToken: (doctorId: DoctorId, tokenId?: string) => Promise<boolean>;
  saveCaseSheet: (visitId: string, caseSheet: CaseSheet) => Promise<boolean>;
  updatePrescriptions: (visitId: string, prescriptions: PrescribedMedicine[]) => Promise<boolean>;
  updateProcedureOrders: (visitId: string, procedureOrders: PrescribedProcedure[]) => Promise<boolean>;
  updateLabOrders: (visitId: string, labOrders: PrescribedLabTest[]) => Promise<boolean>;
  finishConsultation: (visitId: string) => Promise<boolean>;
  billProcedures: (visitId: string, paymentMethod: PaymentMethod, upiRef?: string, discountAmount?: number, discountReason?: string) => Promise<boolean>;
  billWalkInLabs: (data: { patientId?: string; name: string; age: number; sex: 'Male' | 'Female' | 'Other'; phone: string; labTestIds: string[]; paymentMethod: PaymentMethod; upiRef?: string }) => Promise<boolean>;
  markProcedureGiven: (visitId: string, procedureId: string, note?: string) => Promise<boolean>;
  collectLabSample: (visitId: string, labTestId: string) => Promise<boolean>;
  uploadLabResult: (visitId: string, labTestId: string, resultSummary: string, resultAttachment?: string) => Promise<boolean>;
  markProcedureNotGiven: (visitId: string, procedureId: string, reason: string) => Promise<boolean>;
  dispenseMedicine: (visitId: string, medicineIndex: number, qty: number) => Promise<boolean>;
  cancelPharmacyDispensing: (visitId: string) => Promise<boolean>;
  billAndCompletePharmacy: (visitId: string, paymentMethod: PaymentMethod, upiRef?: string) => Promise<boolean>;
  billRetailPharmacy: (data: { patientId?: string; name: string; age: number; sex: 'Male' | 'Female' | 'Other'; phone: string; items: { drugId: string; dosage: string; days: number; qty: number }[]; paymentMethod: PaymentMethod; upiRef?: string }) => Promise<boolean>;
  returnPharmacyItems: (data: { billId: string; items?: { itemIndex: number; qty: number }[]; amount?: number; fullRefund?: boolean; reason: string; refundMethod: 'cash' | 'upi' | 'card'; idempotencyKey?: string }) => Promise<boolean>;
  approveRefund: (billId: string, refundId: string) => Promise<boolean>;
  stockInBatch: (batchData: {
    drugId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    purchasePrice: number;
    supplier: string;
    dateReceived?: string;
  }) => Promise<boolean>;
  writeOffBatch: (batchId: string, reason: string) => Promise<boolean>;
  createTemplate: (templateData: Partial<ClinicalTemplate>) => Promise<boolean>;
  updateTemplate: (id: string, templateData: Partial<ClinicalTemplate>) => Promise<boolean>;
  deleteTemplate: (id: string) => Promise<boolean>;
  openShift: (department: 'reception' | 'pharmacy', shiftType: ShiftType, cashierName: string, openingCash: number) => Promise<boolean>;
  closeShift: (shiftId: string, actualCashCounted: number, handedOverTo: string, handoverNotes?: string) => Promise<boolean>;
  voidBill: (billId: string, reason: string) => Promise<boolean>;
  requestRefund: (data: { billId: string; amount?: number; fullRefund?: boolean; reason: string; refundMethod: 'cash' | 'upi' | 'card'; idempotencyKey?: string }) => Promise<boolean>;
  updateClinicSettings: (settings: Partial<ClinicSettings>) => Promise<boolean>;
  resetDemoData: () => Promise<boolean>;
  saveStaffAccount: (staff: Partial<StaffAccount>) => Promise<boolean>;
  deleteStaffAccount: (id: string) => Promise<boolean>;
  updateDoctorSchedule: (doctorId: DoctorId, schedule: Partial<Doctor>) => Promise<boolean>;
  recordDocumentPrint: (documentType: 'receipt' | 'prescription', documentId: string) => Promise<boolean>;
}

const ClinicContext = createContext<ClinicContextType | undefined>(undefined);

const ROLE_DEFAULT_USERS: Record<Role, string> = {
  receptionist: 'Cashier 1 (placeholder)',
  doctor: 'Doctor 1 (placeholder)',
  nurse: 'Nurse 1 (placeholder)',
  pharmacist: 'Pharmacist 1 (placeholder)',
  laboratory: 'Lab Technician (placeholder)',
  accounts: 'Accounts Manager (placeholder)',
  admin: 'Clinic Administrator (placeholder)',
  tv: 'Waiting Room TV',
  audit: 'Compliance Auditor (placeholder)',
};

export const ClinicProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('pj_isAuthenticated') === 'true';
  });

  const [role, setRoleState] = useState<Role>(() => {
    return (localStorage.getItem('pj_role') as Role) || 'receptionist';
  });

  const [userName, setUserNameState] = useState<string>(() => {
    return localStorage.getItem('pj_username') || ROLE_DEFAULT_USERS[role] || 'Staff User';
  });

  const [currentDoctorId, setCurrentDoctorId] = useState<DoctorId>('doc-1');
  const [isConnected, setIsConnected] = useState(false);

  // Clinic state fetched from server
  const [settings, setSettings] = useState<ClinicSettings>({
    clinicName: 'PJ Medical Center',
    address: 'Mammodu, Kollam, Kerala',
    phone: '+91 82821038615',
    regNumber: 'KL/TVL/2026/001 [Placeholder]',
    gstNote: 'GST configuration pending - confirm with accountant.',
  });
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [drugs, setDrugs] = useState<DrugItem[]>([]);
  const [batches, setBatches] = useState<DrugBatch[]>([]);
  const [procedures, setProcedures] = useState<ProcedureCatalogueItem[]>([]);
  const [labTests, setLabTests] = useState<LabTestCatalogueItem[]>([]);
  const [templates, setTemplates] = useState<ClinicalTemplate[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [visits, setVisits] = useState<TokenVisit[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [patientLedger, setPatientLedger] = useState<PatientLedgerEntry[]>([]);
  const [paymentLedger, setPaymentLedger] = useState<PaymentLedgerEntry[]>([]);
  const [shifts, setShifts] = useState<ShiftRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Modals
  const [activeReceiptBill, setActiveReceiptBill] = useState<Bill | null>(null);
  const [activePrescriptionPrintVisit, setActivePrescriptionPrintVisit] = useState<TokenVisit | null>(null);
  const [activeHistoryPatient, setActiveHistoryPatient] = useState<Patient | null>(null);

  // In-page Toast & Confirmation (Zero alert/confirm)
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);

  const showToast = useCallback((type: 'success' | 'error' | 'warning' | 'info', message: string, title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, message, title }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    setConfirmDialog(options);
  }, []);

  const setRole = (newRole: Role) => {
    setRoleState(newRole);
    localStorage.setItem('pj_role', newRole);
    // If username is currently a placeholder for the previous role, update it to the new role placeholder
    if (Object.values(ROLE_DEFAULT_USERS).includes(userName)) {
      const defaultUser = ROLE_DEFAULT_USERS[newRole];
      setUserNameState(defaultUser);
      localStorage.setItem('pj_username', defaultUser);
    }
  };

  const login = (staff: StaffAccount) => {
    setRoleState(staff.role);
    setUserNameState(staff.name);
    localStorage.setItem('pj_role', staff.role);
    localStorage.setItem('pj_username', staff.name);
    localStorage.setItem('pj_isAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('pj_isAuthenticated');
    setIsAuthenticated(false);
  };

  const setUserName = (name: string) => {
    setUserNameState(name);
    localStorage.setItem('pj_username', name);
  };

  // Helper for API headers with typed user and role
  const getHeaders = useCallback(() => {
    return {
      'Content-Type': 'application/json',
      'x-clinic-role': role,
      'x-clinic-user': userName,
      'x-clinic-user-id': `${role}:${userName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    };
  }, [role, userName]);

  const [latestCalledToken, setLatestCalledToken] = useState<{ tokenNumber: string; room: string; doctorName: string } | null>(null);

  // Synchronize state from snapshot
  const applyStateSnapshot = useCallback((data: any) => {
    if (!data) return;
    try {
      localStorage.setItem('pj-clinic-offline-state', JSON.stringify(data));
    } catch (error) {
      console.warn('Could not cache clinic state for offline use:', error);
    }
    if (data.settings) setSettings(data.settings);
    if (data.staffAccounts) setStaffAccounts(data.staffAccounts);
    if (data.doctors) setDoctors(data.doctors);
    if (data.rooms) setRooms(data.rooms);
    if (data.drugs) setDrugs(data.drugs);
    if (data.batches) setBatches(data.batches);
    if (data.procedures) setProcedures(data.procedures);
      if (data.labTests) setLabTests(data.labTests);
    if (data.templates) setTemplates(data.templates);
    if (data.patients) setPatients(data.patients);
    if (data.visits) setVisits(data.visits);
    if (data.bills) setBills(data.bills);
    if (data.patientLedger) setPatientLedger(data.patientLedger);
    if (data.paymentLedger) setPaymentLedger(data.paymentLedger);
    if (data.shifts) setShifts(data.shifts);
    if (data.auditLogs) setAuditLogs(data.auditLogs);
  }, []);

  // Load the last server snapshot immediately so screens remain usable offline.
  useEffect(() => {
    try {
      const cached = localStorage.getItem('pj-clinic-offline-state');
      if (cached) applyStateSnapshot(JSON.parse(cached));
    } catch (error) {
      console.warn('Could not restore cached clinic state:', error);
    }
  }, [applyStateSnapshot]);

  // Fetch full state once
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        applyStateSnapshot(data);
        setIsConnected(true);
      }
    } catch (err) {
      setIsConnected(false);
      console.warn('Could not fetch clinic state from server:', err);
    }
  }, [applyStateSnapshot]);

  useEffect(() => {
    const handleOnline = () => { void fetchState(); };
    const handleOffline = () => setIsConnected(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchState]);

  // Connect to SSE stream on `/api/events` for real-time live updates
  useEffect(() => {
    fetchState();

    const eventSource = new EventSource('/api/events');

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data);
        if (parsed.payload) {
          applyStateSnapshot(parsed.payload);
        } else {
          fetchState();
        }

        // If a new token was called, play clinic chime!
        if (parsed.type === 'TOKEN_CALLED') {
          playClinicChime();
          if (parsed.payload) {
            setLatestCalledToken({
              tokenNumber: parsed.payload.tokenNumber,
              room: parsed.payload.room,
              doctorName: parsed.payload.doctorName,
            });
          }
        }
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [fetchState, applyStateSnapshot]);

  // ----------------------------------------------------
  // ACTION IMPLEMENTATIONS (Writing to Server)
  // ----------------------------------------------------

  const registerPatient = async (patientData: {
    name: string;
    age: number;
    sex: 'Male' | 'Female' | 'Other';
    phone: string;
    allergies: string[];
  }): Promise<Patient | null> => {
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(patientData),
      });
      const data = await res.json();
      if (!res.ok && data.queued !== true) {
        showToast('error', data.error || 'Registration failed');
        return null;
      }
      if (data.queued) {
        showToast('info', 'Registration queued and will sync when the connection returns.', 'Offline Mode');
        return null;
      }
      showToast('success', `Patient registered with MRN: ${data.mrn}`, 'Patient Created');
      return data;
    } catch (err) {
      showToast('error', 'Network error registering patient.');
      return null;
    }
  };

  const updatePatientAllergies = async (patientId: string, allergies: string[]): Promise<boolean> => {
    try {
      const res = await fetch(`/api/patients/${patientId}/allergies`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ allergies }),
      });
      const data = await res.json();
      if (res.ok) {
        // Immediately update local patients state so all screens update without delay
        const savedAllergies = data.allergies || allergies;
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patientId || p.mrn === patientId ? { ...p, allergies: savedAllergies } : p
          )
        );
        showToast(
          'success',
          `Allergies for ${data.patient?.name || 'patient'} saved to server: [${savedAllergies.join(', ') || 'None'}]`,
          'Allergies Saved'
        );
        return true;
      } else {
        showToast('error', data.error || 'Failed to save allergies to server.', 'Save Failed');
        return false;
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error saving allergies to server.', 'Network Error');
      return false;
    }
  };

  const updatePatientPastHistory = async (patientId: string, pastHistory: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/patients/${patientId}/past-history`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ pastHistory }),
      });
      const data = await res.json();
      if (res.ok) {
        const savedPastHistory = typeof data.pastHistory === 'string' ? data.pastHistory : pastHistory;
        setPatients((prev) =>
          prev.map((p) =>
            p.id === patientId || p.mrn === patientId ? { ...p, pastHistory: savedPastHistory } : p
          )
        );
        showToast(
          'success',
          `Past medical history saved for ${data.patient?.name || 'patient'}.`,
          'Past History Saved'
        );
        return true;
      } else {
        showToast('error', data.error || 'Failed to save past history to server.', 'Save Failed');
        return false;
      }
    } catch (err: any) {
      showToast('error', err.message || 'Network error saving past history to server.', 'Network Error');
      return false;
    }
  };

  const updatePatientDiscount = async (patientId: string, discount: { type: 'percentage' | 'fixed'; value: number; reason: string }): Promise<boolean> => {
    try {
      const res = await fetch(`/api/patients/${patientId}/discount`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(discount) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', data.error || 'Failed to grant patient discount.');
        return false;
      }
      if (data.patient) setPatients((previous) => previous.map((patient) => patient.id === patientId ? data.patient : patient));
      showToast('success', `One-time discount granted to ${data.patient?.name || 'patient'}.`);
      return true;
    } catch {
      showToast('error', 'Network error granting patient discount.');
      return false;
    }
  };

  const createTokenVisit = async (data: {
    patientId: string;
    doctorId: DoctorId;
    reason: string;
    paymentMethod: PaymentMethod;
    upiRef?: string;
  }) => {
    try {
      const res = await fetch('/api/tokens', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok && result.queued !== true) {
        showToast('error', result.error || 'Failed to issue token.');
        return null;
      }
      if (result.queued) {
        showToast('info', 'Token request queued and will sync when online.', 'Offline Mode');
        return null;
      }
      showToast('success', `Token ${result.visit.tokenNumber} issued successfully! Fee ₹${result.bill.total} recorded.`);
      setActiveReceiptBill(result.bill);
      return result;
    } catch (err) {
      showToast('error', 'Network error creating token visit.');
      return null;
    }
  };

  const callNextToken = async (doctorId: DoctorId, tokenId?: string): Promise<boolean> => {
    const nextToken = tokenId
      ? visits.find((v) => v.id === tokenId)
      : visits
          .filter((v) => v.doctorId === doctorId && v.status === 'waiting_doctor')
          .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())[0];

    if (!nextToken) {
      showToast('info', 'No waiting patients in queue for this doctor.');
      return false;
    }

    try {
      const res = await fetch(`/api/tokens/${nextToken.id}/call`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ doctorId }),
      });
      const result = await res.json();
      if (!res.ok && result.queued !== true) {
        showToast('error', result.error || 'Could not call token.');
        return false;
      }
      if (result.queued) {
        showToast('info', 'Token call queued and will sync when online.', 'Offline Mode');
        return true;
      }
      showToast('success', `Called Token ${nextToken.tokenNumber} into ${result.room.name}`, 'Token Called');
      playClinicChime();
      return true;
    } catch (err) {
      showToast('error', 'Failed to call token.');
      return false;
    }
  };

  const saveCaseSheet = async (visitId: string, caseSheet: CaseSheet): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tokens/${visitId}/case-sheet`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(caseSheet),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast('error', data.error || 'Failed to save case sheet.');
        return false;
      }
      showToast('success', 'Case sheet saved successfully.');
      return true;
    } catch (err) {
      showToast('error', 'Network error saving case sheet.');
      return false;
    }
  };

  const updatePrescriptions = async (visitId: string, prescriptions: PrescribedMedicine[]): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tokens/${visitId}/prescriptions`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ prescriptions }),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const updateProcedureOrders = async (visitId: string, procedureOrders: PrescribedProcedure[]): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tokens/${visitId}/procedures`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ procedureOrders }),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };
  const updateLabOrders = async (visitId: string, labOrders: PrescribedLabTest[]): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tokens/${visitId}/labs`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ labOrders }),
      });
      return res.ok;
    } catch (err) {
      return false;
    }
  };


  const finishConsultation = async (visitId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/tokens/${visitId}/finish-consultation`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const result = await res.json();
      if (!res.ok && result.queued !== true) {
        showToast('error', result.error || 'Could not finish consultation.');
        return false;
      }
      if (result.queued) {
        showToast('info', 'Consultation completion queued and will sync when online.', 'Offline Mode');
        return true;
      }
      showToast('success', `Consultation complete. Patient routed to: ${result.nextStage.replace(/_/g, ' ')}. Room freed.`);
      return true;
    } catch (err) {
      showToast('error', 'Network error completing consultation.');
      return false;
    }
  };

  const billProcedures = async (visitId: string, paymentMethod: PaymentMethod, upiRef?: string, discountAmount?: number, discountReason?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/bills/procedure', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ visitId, paymentMethod, upiRef, discountAmount, discountReason }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Procedure billing failed.');
        return false;
      }
      showToast('success', `Procedure invoice ${result.bill.invoiceNo} (₹${result.bill.total}) generated. Ready for Nurse check.`);
      setActiveReceiptBill(result.bill);
      return true;
    } catch (err) {
      showToast('error', 'Network error billing procedures.');
      return false;
    }
  };

  const collectLabSample = async (visitId: string, labTestId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/labs/${visitId}/${labTestId}/collected`, { method: 'POST', headers: getHeaders() });
      if (!res.ok) return false;
      showToast('success', 'Sample collection recorded.');
      return true;
    } catch { return false; }
  };

  const uploadLabResult = async (visitId: string, labTestId: string, resultSummary: string, resultAttachment?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/labs/${visitId}/${labTestId}/report`, { method: 'POST', headers: getHeaders(), body: JSON.stringify({ resultSummary, resultAttachment }) });
      const data = await res.json();
      if (!res.ok) { showToast('error', data.error || 'Could not upload laboratory result.'); return false; }
      showToast('success', 'Laboratory result uploaded.');
      return true;
    } catch { showToast('error', 'Network error uploading laboratory result.'); return false; }
  };

  const billWalkInLabs = async (data: { patientId?: string; name: string; age: number; sex: 'Male' | 'Female' | 'Other'; phone: string; labTestIds: string[]; paymentMethod: PaymentMethod; upiRef?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/bills/lab/walk-in', { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { showToast('error', result.error || 'Walk-in laboratory billing failed.'); return false; }
      showToast('success', `Lab invoice ${result.bill.invoiceNo} (₹${result.bill.total}) generated.`);
      setActiveReceiptBill(result.bill);
      return true;
    } catch { showToast('error', 'Network error creating walk-in lab bill.'); return false; }
  };

  const markProcedureGiven = async (visitId: string, procedureId: string, note?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/procedures/${visitId}/${procedureId}/given`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ note }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Could not mark procedure given.');
        return false;
      }
      showToast('success', 'Marked procedure as GIVEN.');
      return true;
    } catch (err) {
      showToast('error', 'Failed to mark procedure given.');
      return false;
    }
  };

  const markProcedureNotGiven = async (visitId: string, procedureId: string, reason: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/procedures/${visitId}/${procedureId}/not-given`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Failed to record note.');
        return false;
      }
      showToast('info', 'Recorded procedure as NOT GIVEN with reason.');
      return true;
    } catch (err) {
      showToast('error', 'Failed to record procedure.');
      return false;
    }
  };

  const dispenseMedicine = async (visitId: string, medicineIndex: number, qty: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/dispense', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ visitId, medicineIndex, qty }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Dispense failed.');
        return false;
      }
      // Refresh immediately so dispensing status and the pharmacy bill update
      // even if an SSE connection is temporarily unavailable.
      await fetchState();
      showToast(
        'success',
        `Dispensed ${qty} units from Batch ${result.batchUsed.batchNumber} (Expires ${result.batchUsed.expiryDate}). Stock updated on server.`,
        'Dispense Confirmed'
      );
      return true;
    } catch (err) {
      showToast('error', 'Failed to dispense medicine.');
      return false;
    }
  };

  const cancelPharmacyDispensing = async (visitId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/cancel', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ visitId }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Could not cancel the pharmacy bill.');
        return false;
      }
      await fetchState();
      showToast('success', 'Dispensed medicines were cancelled and returned to stock.');
      return true;
    } catch (err) {
      showToast('error', 'Failed to cancel pharmacy dispensing.');
      return false;
    }
  };

  const billAndCompletePharmacy = async (visitId: string, paymentMethod: PaymentMethod, upiRef?: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/bill', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ visitId, paymentMethod, upiRef }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Pharmacy billing failed.');
        return false;
      }
      showToast('success', `Pharmacy invoice ${result.bill.invoiceNo} (₹${result.bill.total}) generated. Patient journey completed.`);
      setActiveReceiptBill(result.bill);
      return true;
    } catch (err) {
      showToast('error', 'Failed to generate pharmacy bill.');
      return false;
    }
  };

  const billRetailPharmacy = async (data: { patientId?: string; name: string; age: number; sex: 'Male' | 'Female' | 'Other'; phone: string; items: { drugId: string; dosage: string; days: number; qty: number }[]; paymentMethod: PaymentMethod; upiRef?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/bill-retail', { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
      const result = await res.json();
      if (!res.ok) { showToast('error', result.error || 'Retail pharmacy billing failed.'); return false; }
      showToast('success', `Retail invoice ${result.bill.invoiceNo} (₹${result.bill.total}) generated.`);
      setActiveReceiptBill(result.bill);
      return true;
    } catch { showToast('error', 'Failed to generate retail pharmacy bill.'); return false; }
  };

  const returnPharmacyItems = async (data: { billId: string; items?: { itemIndex: number; qty: number }[]; amount?: number; fullRefund?: boolean; reason: string; refundMethod: 'cash' | 'upi' | 'card'; idempotencyKey?: string }): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/return-items', { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { showToast('error', result.error || `Failed to process pharmacy return (${res.status}).`); return false; }
      showToast('success', `Return requested for approval. ₹${result.refund?.amount || 0} awaiting Accounts approval.`);
      return true;
    } catch {
      showToast('error', 'Failed to request pharmacy return.');
      return false;
    }
  };

  const approveRefund = async (billId: string, refundId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bills/${billId}/refunds/${refundId}/approve`, { method: 'POST', headers: getHeaders() });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) { showToast('error', result.error || 'Failed to approve refund.'); return false; }
      showToast('success', `Refund ₹${result.refund.amount} approved and posted.`);
      return true;
    } catch { showToast('error', 'Failed to approve refund.'); return false; }
  };

  const stockInBatch = async (batchData: {
    drugId: string;
    batchNumber: string;
    expiryDate: string;
    quantity: number;
    purchasePrice: number;
    supplier: string;
    dateReceived?: string;
  }): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/stock-in', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(batchData),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Stock-in failed.');
        return false;
      }
      showToast('success', `Added batch ${result.batchNumber} (${result.quantity} units, Exp: ${result.expiryDate}).`, 'Stock-In Logged');
      return true;
    } catch (err) {
      showToast('error', 'Network error during stock-in.');
      return false;
    }
  };

  const writeOffBatch = async (batchId: string, reason: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/pharmacy/write-off', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ batchId, reason }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Write-off failed.');
        return false;
      }
      showToast('warning', `Expired batch written off (${result.batch.writeOffQuantity} units). Recorded to audit log.`, 'Write-Off Executed');
      return true;
    } catch (err) {
      showToast('error', 'Network error during write-off.');
      return false;
    }
  };

  const createTemplate = async (templateData: Partial<ClinicalTemplate>): Promise<boolean> => {
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(templateData),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Failed to create template.');
        return false;
      }
      showToast('success', `Template "${result.name}" created successfully.`);
      return true;
    } catch (err) {
      showToast('error', 'Failed to create template.');
      return false;
    }
  };

  const updateTemplate = async (id: string, templateData: Partial<ClinicalTemplate>): Promise<boolean> => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(templateData),
      });
      if (!res.ok) {
        showToast('error', 'Failed to update template.');
        return false;
      }
      showToast('success', 'Template updated successfully.');
      return true;
    } catch (err) {
      showToast('error', 'Network error updating template.');
      return false;
    }
  };

  const deleteTemplate = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        showToast('error', 'Failed to delete template.');
        return false;
      }
      showToast('info', 'Template deleted. Consultation case sheets remain unaffected.');
      return true;
    } catch (err) {
      showToast('error', 'Failed to delete template.');
      return false;
    }
  };

  const openShift = async (department: 'reception' | 'pharmacy', shiftType: ShiftType, cashierName: string, openingCash: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/shifts/open', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ department, shiftType, cashierName, openingCash }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Failed to open shift.');
        return false;
      }
      showToast('success', `Opened ${result.shiftType} for ${result.department} with ₹${result.openingCash} opening float.`);
      return true;
    } catch (err) {
      showToast('error', 'Network error opening shift.');
      return false;
    }
  };

  const closeShift = async (shiftId: string, actualCashCounted: number, handedOverTo: string, handoverNotes?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/shifts/${shiftId}/close`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ actualCashCounted, handedOverTo, handoverNotes }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Failed to close shift.');
        return false;
      }
      showToast(
        'info',
        `Shift closed. Cash counted: ₹${result.closingActualCash}. Discrepancy: ${result.difference >= 0 ? '+' : ''}₹${result.difference}.`
      );
      return true;
    } catch (err) {
      showToast('error', 'Failed to close shift.');
      return false;
    }
  };

  const voidBill = async (billId: string, reason: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bills/${billId}/void`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ reason }),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Failed to void invoice.');
        return false;
      }
      if (result.requiresApproval) {
        showToast('warning', `Cancellation requested for invoice ${result.bill.invoiceNo}. Awaiting Accounts approval.`);
      } else {
        showToast('warning', `Invoice ${result.bill.invoiceNo} has been marked as VOIDED. Recorded in audit trail.`);
      }
      return true;
    } catch (err) {
      showToast('error', 'Failed to void invoice.');
      return false;
    }
  };

  const requestRefund = async (data: { billId: string; amount?: number; fullRefund?: boolean; reason: string; refundMethod: 'cash' | 'upi' | 'card'; idempotencyKey?: string }): Promise<boolean> => {
    try {
      const res = await fetch(`/api/bills/${data.billId}/refund`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast('error', result.error || 'Failed to request refund.');
        return false;
      }
      showToast('success', `Refund requested for Accounts approval. ₹${result.refund?.amount || 0}.`);
      return true;
    } catch {
      showToast('error', 'Failed to request refund.');
      return false;
    }
  };

  const updateClinicSettings = async (newSettings: Partial<ClinicSettings>): Promise<boolean> => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(newSettings),
      });
      if (!res.ok) {
        showToast('error', 'Failed to update clinic settings.');
        return false;
      }
      showToast('success', 'Clinic settings updated successfully.');
      return true;
    } catch (err) {
      showToast('error', 'Network error updating settings.');
      return false;
    }
  };

  const saveStaffAccount = async (staff: Partial<StaffAccount>): Promise<boolean> => {
    const res = await fetch(staff.id ? `/api/staff/${staff.id}` : '/api/staff', {
      method: staff.id ? 'PUT' : 'POST', headers: getHeaders(), body: JSON.stringify(staff),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) { showToast('error', result.error || 'Failed to save staff account.'); return false; }
    if (result.state) applyStateSnapshot(result.state);
    showToast('success', staff.id ? 'Staff account updated.' : 'Staff account created.');
    return true;
  };

  const deleteStaffAccount = async (id: string): Promise<boolean> => {
    const res = await fetch(`/api/staff/${id}`, { method: 'DELETE', headers: getHeaders() });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) { showToast('error', result.error || 'Failed to remove staff account.'); return false; }
    if (result.state) applyStateSnapshot(result.state);
    showToast('success', 'Staff account deactivated.');
    return true;
  };

  const updateDoctorSchedule = async (doctorId: DoctorId, schedule: Partial<Doctor>): Promise<boolean> => {
    const res = await fetch(`/api/doctors/${doctorId}/schedule`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(schedule) });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) { showToast('error', result.error || 'Failed to update doctor schedule.'); return false; }
    if (result.state) applyStateSnapshot(result.state); else if (result.id) setDoctors((current) => current.map((doctor) => doctor.id === doctorId ? { ...doctor, ...result } : doctor));
    showToast('success', 'Doctor schedule and room assignment updated.');
    return true;
  };

  const recordDocumentPrint = async (documentType: 'receipt' | 'prescription', documentId: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/documents/print', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ documentType, documentId }),
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  const resetDemoData = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/admin/reset', {
        method: 'POST',
        headers: getHeaders(),
      });
      const result = await res.json();
      if (!res.ok) {
        showToast('error', result.error || 'Reset failed.');
        return false;
      }
      showToast('success', result.message || 'Demo data reset. Audit log preserved.');
      return true;
    } catch (err) {
      showToast('error', 'Failed to reset demo data.');
      return false;
    }
  };

  return (
    <ClinicContext.Provider
      value={{
        role,
        setRole,
        userName,
        setUserName,
        isAuthenticated,
        login,
        logout,
        settings,
        staffAccounts,
        fallbackStaffAccounts: FALLBACK_STAFF_ACCOUNTS,
        doctors,
        rooms,
        drugs,
        batches,
        procedures,
    labTests,
        templates,
        patients,
        visits,
        bills,
        patientLedger,
        paymentLedger,
        shifts,
        auditLogs,
        currentDoctorId,
        setCurrentDoctorId,
        isConnected,
        currentUser: { name: userName, role },
        latestCalledToken,
        activeReceiptBill,
        setActiveReceiptBill,
        activePrescriptionPrintVisit,
        setActivePrescriptionPrintVisit,
        activeHistoryPatient,
        setActiveHistoryPatient,
        showToast,
        showConfirm,
        registerPatient,
        updatePatientAllergies,
        updatePatientPastHistory,
        updatePatientDiscount,
        createTokenVisit,
        callNextToken,
        saveCaseSheet,
        updatePrescriptions,
        updateProcedureOrders,
    updateLabOrders,
        finishConsultation,
        billProcedures,
    billWalkInLabs,
        markProcedureGiven,
    collectLabSample,
    uploadLabResult,
        markProcedureNotGiven,
        dispenseMedicine,
        cancelPharmacyDispensing,
        billAndCompletePharmacy,
        billRetailPharmacy,
        returnPharmacyItems,
        approveRefund,
        stockInBatch,
        writeOffBatch,
        createTemplate,
        updateTemplate,
        deleteTemplate,
        openShift,
        closeShift,
        voidBill,
        requestRefund,
        updateClinicSettings,
        resetDemoData,
        saveStaffAccount,
        deleteStaffAccount,
        updateDoctorSchedule,
        recordDocumentPrint,
      }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <ConfirmDialog dialog={confirmDialog} onClose={() => setConfirmDialog(null)} />
    </ClinicContext.Provider>
  );
};

export const useClinic = () => {
  const context = useContext(ClinicContext);
  if (!context) throw new Error('useClinic must be used within ClinicProvider');
  return context;
};
