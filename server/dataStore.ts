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
} from './initialData';

// Simulated current clinic date
export const CURRENT_DATE = '2026-10-25';

class ClinicDataStore {
  public settings: ClinicSettings = { ...INITIAL_SETTINGS };
  public doctors: Doctor[] = JSON.parse(JSON.stringify(INITIAL_DOCTORS));
  public rooms: Room[] = JSON.parse(JSON.stringify(INITIAL_ROOMS));
  public drugs: DrugItem[] = JSON.parse(JSON.stringify(INITIAL_DRUGS));
  public batches: DrugBatch[] = JSON.parse(JSON.stringify(INITIAL_BATCHES)).map((batch: DrugBatch) => ({
    ...batch,
    status: batch.status || (batch.quantity > 0 ? 'active' : 'depleted'),
  }));
  public procedures: ProcedureCatalogueItem[] = JSON.parse(JSON.stringify(INITIAL_PROCEDURES));
  public labTests: LabTestCatalogueItem[] = JSON.parse(JSON.stringify(INITIAL_LAB_TESTS));
  public templates: ClinicalTemplate[] = JSON.parse(JSON.stringify(INITIAL_TEMPLATES));
  public patients: Patient[] = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
  public shifts: ShiftRecord[] = JSON.parse(JSON.stringify(INITIAL_SHIFTS));
  public visits: TokenVisit[] = JSON.parse(JSON.stringify(INITIAL_VISITS));
  public bills: Bill[] = JSON.parse(JSON.stringify(INITIAL_BILLS));
  public auditLogs: AuditLog[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));

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
      auditLogs: this.auditLogs,
      currentDate: CURRENT_DATE,
    };
  }

  // Reset Demo Data (Stage 1 Requirement: Must NOT delete audit log!)
  public resetDemoData(userName: string, role: string) {
    const oldVisitsCount = this.visits.length;
    const oldBillsCount = this.bills.length;

    // Reset clinical and billing entities
    this.doctors = JSON.parse(JSON.stringify(INITIAL_DOCTORS));
    this.rooms = JSON.parse(JSON.stringify(INITIAL_ROOMS));
    this.drugs = JSON.parse(JSON.stringify(INITIAL_DRUGS));
    this.batches = JSON.parse(JSON.stringify(INITIAL_BATCHES));
    this.procedures = JSON.parse(JSON.stringify(INITIAL_PROCEDURES));
    this.templates = JSON.parse(JSON.stringify(INITIAL_TEMPLATES));
    this.patients = JSON.parse(JSON.stringify(INITIAL_PATIENTS));
    this.shifts = JSON.parse(JSON.stringify(INITIAL_SHIFTS));
    this.visits = JSON.parse(JSON.stringify(INITIAL_VISITS));
    this.bills = JSON.parse(JSON.stringify(INITIAL_BILLS));
    this.settings = JSON.parse(JSON.stringify(INITIAL_SETTINGS));

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
