import { Response } from 'express';
import {
  Doctor,
  Room,
  DrugItem,
  DrugBatch,
  ProcedureCatalogueItem,
  LabTestCatalogueItem,
  ClinicalTemplate,
  Patient,
  TokenVisit,
  Bill,
  ShiftRecord,
  AuditLog,
  ClinicSettings,
  DoctorId,
  PaymentMethod,
  ShiftType,
  CaseSheet,
  PrescribedMedicine,
  PrescribedProcedure,
  PatientStage,
  PatientLedgerEntry,
  PaymentLedgerEntry,
  StaffAccount,
} from './types';
import {
  INITIAL_SETTINGS,
  INITIAL_DOCTORS,
  INITIAL_ROOMS,
  INITIAL_DRUGS,
  INITIAL_BATCHES,
  INITIAL_PROCEDURES,
  INITIAL_LAB_TESTS,
  INITIAL_TEMPLATES,
  INITIAL_PATIENTS,
  INITIAL_SHIFTS,
  INITIAL_VISITS,
  INITIAL_BILLS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STAFF_ACCOUNTS,
} from './initialData';

// Simulated current clinic date
export const CURRENT_DATE = '2026-10-25';

class ClinicDataStore {
  public settings: ClinicSettings = { ...INITIAL_SETTINGS };
  public staffAccounts: StaffAccount[] = structuredClone(INITIAL_STAFF_ACCOUNTS);
  public doctors: Doctor[] = structuredClone(INITIAL_DOCTORS);
  public rooms: Room[] = structuredClone(INITIAL_ROOMS);
  public drugs: DrugItem[] = structuredClone(INITIAL_DRUGS);
  public batches: DrugBatch[] = structuredClone(INITIAL_BATCHES).map((batch: DrugBatch) => ({
    ...batch,
    status: batch.status || (batch.quantity > 0 ? 'active' : 'depleted'),
  }));
  public procedures: ProcedureCatalogueItem[] = structuredClone(INITIAL_PROCEDURES);
  public labTests: LabTestCatalogueItem[] = structuredClone(INITIAL_LAB_TESTS);
  public templates: ClinicalTemplate[] = structuredClone(INITIAL_TEMPLATES);
  public patients: Patient[] = structuredClone(INITIAL_PATIENTS);
  public shifts: ShiftRecord[] = structuredClone(INITIAL_SHIFTS);
  public visits: TokenVisit[] = structuredClone(INITIAL_VISITS);
  public bills: Bill[] = structuredClone(INITIAL_BILLS);
  public patientLedger: PatientLedgerEntry[] = [];
  public paymentLedger: PaymentLedgerEntry[] = [];
  public auditLogs: AuditLog[] = structuredClone(INITIAL_AUDIT_LOGS);

  constructor() {
    const seen = new Set<string>();
    for (const bill of this.bills) {
      if (seen.has(bill.invoiceNo)) throw new Error(`Duplicate initial invoice number: ${bill.invoiceNo}`);
      seen.add(bill.invoiceNo);
      Object.defineProperty(bill, 'invoiceNo', {
        value: bill.invoiceNo,
        enumerable: true,
        configurable: false,
        writable: false,
      });
    }
    this.rebuildLedgers();
  }

  private readonly documentCounters = new Map<string, number>();

  private getFinancialYear(timestamp = new Date().toISOString()) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const startYear = date.getMonth() >= 3 ? year : year - 1;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
  }

  public rebuildLedgers(additionalBill?: Bill) {
    this.patientLedger = [];
    this.paymentLedger = [];
    const runningBalances = new Map<string, number>();
    const sourceBills = additionalBill ? [additionalBill, ...this.bills] : this.bills;
    const orderedBills = [...sourceBills].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const bill of orderedBills) {
      const balance = runningBalances.get(bill.patientId) || 0;
      const isVoid = bill.status === 'voided' || bill.status === 'cancelled';
      if (!isVoid) {
        const chargeBalance = balance + bill.total;
        this.patientLedger.push({
          id: `pl-${bill.id}-charge`, patientId: bill.patientId, patientMrn: bill.patientMrn,
          visitId: bill.visitId, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          type: 'charge', description: `${bill.type} invoice`, debit: bill.total, credit: 0,
          runningBalance: chargeBalance, timestamp: bill.timestamp,
        });
        runningBalances.set(bill.patientId, chargeBalance);
      }

      const paid = bill.amountPaid ?? (isVoid ? 0 : bill.total);
      if (paid > 0) {
        const paymentBalance = (runningBalances.get(bill.patientId) || 0) - paid;
        this.patientLedger.push({
          id: `pl-${bill.id}-payment`, patientId: bill.patientId, patientMrn: bill.patientMrn,
          visitId: bill.visitId, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          type: 'payment', description: `Payment received for ${bill.invoiceNo}`, debit: 0, credit: paid,
          runningBalance: paymentBalance, timestamp: bill.timestamp, reference: bill.upiRef,
        });
        this.paymentLedger.push({
          id: `pay-${bill.id}`, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          patientId: bill.patientId, patientMrn: bill.patientMrn, visitId: bill.visitId,
          type: 'payment', method: bill.paymentMethod, amount: paid,
          transactionReference: bill.upiRef, status: 'completed', shift: bill.shift,
          cashierName: bill.cashierName, timestamp: bill.timestamp,
        });
        runningBalances.set(bill.patientId, paymentBalance);
      }

      for (const refund of bill.refunds?.filter((r) => r.status === 'completed') || []) {
        const refundTimestamp = refund.approvedAt || refund.createdAt;
        const refundBalance = (runningBalances.get(bill.patientId) || 0) + refund.amount;
        this.patientLedger.push({
          id: `pl-${refund.id}-refund`, patientId: bill.patientId, patientMrn: bill.patientMrn,
          visitId: bill.visitId, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          type: 'refund', description: `Refund ${refund.refundNo} for ${bill.invoiceNo}`, debit: refund.amount, credit: 0,
          runningBalance: refundBalance, timestamp: refundTimestamp, reference: refund.id,
        });
        this.paymentLedger.push({
          id: `pay-${refund.id}`, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          patientId: bill.patientId, patientMrn: bill.patientMrn, visitId: bill.visitId,
          type: 'refund', method: refund.method, amount: refund.amount, status: 'completed',
          shift: bill.shift, cashierName: refund.approvedByName || refund.createdByName, timestamp: refundTimestamp,
        });
        runningBalances.set(bill.patientId, refundBalance);
      }

      if (isVoid) {
        const voidBalance = (runningBalances.get(bill.patientId) || 0) - bill.total;
        this.patientLedger.push({
          id: `pl-${bill.id}-void`, patientId: bill.patientId, patientMrn: bill.patientMrn,
          visitId: bill.visitId, invoiceId: bill.id, invoiceNo: bill.invoiceNo,
          type: 'void', description: `Voided ${bill.invoiceNo}`, debit: 0, credit: bill.total,
          runningBalance: voidBalance, timestamp: bill.voidTimestamp || bill.timestamp,
        });
        runningBalances.set(bill.patientId, voidBalance);
      }
    }
  }

  public finalizeInvoiceDocument(bill: Bill) {
    if (this.bills.some((existing) => existing.invoiceNo === bill.invoiceNo)) {
      throw new Error(`Duplicate invoice number: ${bill.invoiceNo}`);
    }
    if (bill.status === 'paid' || bill.status === 'finalized' || bill.status === 'partially_paid') {
      bill.amountPaid = bill.amountPaid ?? bill.total;
      bill.balanceDue = Math.max(0, bill.total - bill.amountPaid);
    }
    Object.defineProperty(bill, 'invoiceNo', {
      value: bill.invoiceNo,
      enumerable: true,
      configurable: false,
      writable: false,
    });
    this.rebuildLedgers(bill);
  }

  public allocateInvoiceNumber(series: 'REC' | 'LAB' | 'PHM' | 'RPM', timestamp = new Date().toISOString()) {
    const year = new Date(timestamp).getFullYear();
    const financialYear = this.getFinancialYear(timestamp);
    const key = `${series}-${year}`;

    if (!this.documentCounters.has(key)) {
      const prefix = `${series}-${year}-`;
      const existingSequences = this.bills
        .filter((bill) => bill.invoiceNo.startsWith(prefix))
        .map((bill) => Number(bill.invoiceNo.slice(prefix.length)))
        .filter(Number.isInteger);
      this.documentCounters.set(key, existingSequences.length ? Math.max(...existingSequences) : 0);
    }

    const sequence = (this.documentCounters.get(key) || 0) + 1;
    if (this.bills.some((bill) => bill.invoiceNo === `${series}-${year}-${String(sequence).padStart(4, '0')}`)) {
      throw new Error(`Invoice sequence ${sequence} is already allocated.`);
    }

    this.documentCounters.set(key, sequence);
    return {
      invoiceNo: `${series}-${year}-${String(sequence).padStart(4, '0')}`,
      documentSeries: series,
      documentNumberSequence: sequence,
      financialYear,
    };
  }

  // SSE connected clients
  private sseClients: Response[] = [];

  // Register an SSE client
  public addSseClient(res: Response) {
    this.sseClients.push(res);
  }

  // Remove an SSE client on disconnect
  public removeSseClient(res: Response) {
    this.sseClients = this.sseClients.filter((client) => client !== res);
  }

  // Broadcast state to all connected screens immediately
  public broadcastUpdate(eventType: string = 'STATE_UPDATE', meta?: any) {
    const fullState = this.getFullState();
    const data = JSON.stringify({
      type: eventType,
      timestamp: new Date().toISOString(),
      payload: fullState,
      meta: meta || {},
    });

    for (const client of this.sseClients) {
      try {
        client.write(`data: ${data}\n\n`);
      } catch (err) {
        // Ignored, client will be cleaned up on close
      }
    }
  }

  // Helper: Append immutable audit entry
  public addAuditLog(
    role: string,
    userName: string,
    action: string,
    targetEntity: string,
    details: string,
    patientMrn?: string,
    beforeValue?: any,
    afterValue?: any
  ): AuditLog {
    const entry: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      role: role.toUpperCase(),
      userName: userName || 'Anonymous',
      action,
      targetEntity,
      patientMrn,
      beforeValue,
      afterValue,
      details,
    };
    this.auditLogs.unshift(entry);
    return entry;
  }

  // Calculate stock on hand for a drug (sum of unexpired, non-written-off batches)
  public getDrugStock(drugId: string): number {
    return this.batches
      .filter((b) => b.drugId === drugId && !b.isWrittenOff && b.expiryDate >= CURRENT_DATE)
      .reduce((sum, b) => sum + b.quantity, 0);
  }

  // Find next expiring valid batch for a drug (FEFO - First Expiry, First Out)
  public getNextFefoBatch(drugId: string): DrugBatch | null {
    const validBatches = this.batches
      .filter((b) => b.drugId === drugId && !b.isWrittenOff && b.quantity > 0 && b.expiryDate >= CURRENT_DATE)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

    return validBatches[0] || null;
  }

  // Check if a batch is near-expiry (within 30 days)
  public isNearExpiry(expiryDate: string): boolean {
    const exp = new Date(expiryDate).getTime();
    const curr = new Date(CURRENT_DATE).getTime();
    const diffDays = (exp - curr) / (1000 * 60 * 60 * 24);
    return diffDays >= 0 && diffDays <= 30;
  }

  // Check if a batch is expired
  public isExpired(expiryDate: string): boolean {
    return expiryDate < CURRENT_DATE;
  }

  // Full state snapshot for clients
  public getFullState() {
    // Enrich drugs with calculated live stock and FEFO earliest batch
    const enrichedDrugs = this.drugs.map((d) => {
      const stockQty = this.getDrugStock(d.id);
      const nextBatch = this.getNextFefoBatch(d.id);
      return {
        ...d,
        stockQty,
        earliestBatchNumber: nextBatch?.batchNumber || null,
        earliestExpiryDate: nextBatch?.expiryDate || null,
        isNearExpiry: nextBatch ? this.isNearExpiry(nextBatch.expiryDate) : false,
      };
    });

    return {
      settings: this.settings,
      staffAccounts: this.staffAccounts,
      doctors: this.doctors,
      rooms: this.rooms,
      drugs: enrichedDrugs,
      batches: this.batches,
      procedures: this.procedures,
      labTests: this.labTests,
      templates: this.templates,
      patients: this.patients,
      shifts: this.shifts,
      visits: this.visits,
      bills: this.bills,
      patientLedger: this.patientLedger,
      paymentLedger: this.paymentLedger,
      auditLogs: this.auditLogs,
      currentDate: CURRENT_DATE,
    };
  }

  // Reset Demo Data (Stage 1 Requirement: Must NOT delete audit log!)
  public resetDemoData(userName: string, role: string) {
    const oldVisitsCount = this.visits.length;
    const oldBillsCount = this.bills.length;

    // Reset clinical and billing entities
    this.doctors = structuredClone(INITIAL_DOCTORS);
    this.rooms = structuredClone(INITIAL_ROOMS);
    this.drugs = structuredClone(INITIAL_DRUGS);
    this.batches = structuredClone(INITIAL_BATCHES);
    this.procedures = structuredClone(INITIAL_PROCEDURES);
    this.templates = structuredClone(INITIAL_TEMPLATES);
    this.patients = structuredClone(INITIAL_PATIENTS);
    this.shifts = structuredClone(INITIAL_SHIFTS);
    this.visits = structuredClone(INITIAL_VISITS);
    this.bills = structuredClone(INITIAL_BILLS);
    this.rebuildLedgers();
    this.documentCounters.clear();
    this.settings = structuredClone(INITIAL_SETTINGS);

    // Audit log is explicitly PRESERVED and an entry for the reset is appended!
    this.addAuditLog(
      role,
      userName,
      'RESET_DEMO_DATA',
      'System: Clinical & Billing Data',
      `Administrator ${userName} performed prototype demo data reset. Audit log preserved with ${this.auditLogs.length} historical entries.`,
      undefined,
      { visitsCount: oldVisitsCount, billsCount: oldBillsCount },
      { visitsCount: this.visits.length, billsCount: this.bills.length }
    );

    this.broadcastUpdate('DEMO_DATA_RESET');
  }
}

export const clinicStore = new ClinicDataStore();
