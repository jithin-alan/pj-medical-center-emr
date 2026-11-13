import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { clinicStore, CURRENT_DATE } from './server/dataStore';
import {
  Patient,
  TokenVisit,
  Bill,
  PrescribedMedicine,
  PrescribedProcedure,
  PrescribedLabTest,
  ClinicalTemplate,
  DrugBatch,
  PatientStage,
  ShiftRecord,
  ShiftType
} from './server/types';

const getBilledItem = (items: Bill['items'], itemName: string) =>
  items.find((item) => item.name.replace(/^\[(Procedure|Lab)\]\s*/, '').trim() === itemName.trim());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Helper to extract role and user from request headers
function getUserContext(req: Request) {
  const role = String(req.headers['x-clinic-role'] || 'receptionist').trim().toLowerCase();
  const userName = String(req.headers['x-clinic-user'] || 'Staff User').trim();
  const userId = String(req.headers['x-clinic-user-id'] || userName.toLowerCase().replace(/[^a-z0-9]+/g, '-')).trim();
  return { role, userName, userId };
}

// ----------------------------------------------------
// 1. LIVE DATA SSE STREAM
// ----------------------------------------------------
app.get('/api/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send current state on connection
  const initialPayload = JSON.stringify({
    type: 'CONNECTED',
    timestamp: new Date().toISOString(),
    payload: clinicStore.getFullState(),
  });
  res.write(`data: ${initialPayload}\n\n`);

  clinicStore.addSseClient(res);

  req.on('close', () => {
    clinicStore.removeSseClient(res);
  });
});

// GET full state snapshot
app.get('/api/state', (req: Request, res: Response) => {
  res.json(clinicStore.getFullState());
});

// Record print and reprint events against the immutable audit trail.
app.post('/api/documents/print', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { documentType, documentId } = req.body;

  if (documentType === 'receipt') {
    const bill = clinicStore.bills.find((item) => item.id === documentId || item.invoiceNo === documentId);
    if (!bill) return res.status(404).json({ error: 'Receipt not found.' });
    const previousCount = bill.printCount || 0;
    bill.printCount = previousCount + 1;
    bill.lastPrintedAt = new Date().toISOString();
    const action = previousCount === 0 ? 'PRINT_RECEIPT' : 'REPRINT_RECEIPT';
    clinicStore.addAuditLog(role, userName, action, `Invoice: ${bill.invoiceNo}`, `${action === 'REPRINT_RECEIPT' ? 'Reprinted' : 'Printed'} receipt for ${bill.patientName} (${bill.patientMrn}); print count: ${bill.printCount}.`, bill.patientMrn, { printCount: previousCount }, { printCount: bill.printCount });
    clinicStore.broadcastUpdate('DOCUMENT_PRINTED', { documentType, documentId: bill.id });
    return res.json({ success: true, printCount: bill.printCount, action });
  }

  if (documentType === 'prescription') {
    const visit = clinicStore.visits.find((item) => item.id === documentId);
    if (!visit) return res.status(404).json({ error: 'Prescription visit not found.' });
    const patient = clinicStore.patients.find((item) => item.id === visit.patientId);
    const previousCount = visit.printCount || 0;
    visit.printCount = previousCount + 1;
    visit.lastPrintedAt = new Date().toISOString();
    const action = previousCount === 0 ? 'PRINT_PRESCRIPTION' : 'REPRINT_PRESCRIPTION';
    clinicStore.addAuditLog(role, userName, action, `Prescription: ${visit.tokenNumber}`, `${action === 'REPRINT_PRESCRIPTION' ? 'Reprinted' : 'Printed'} prescription for ${patient?.name || 'patient'} (${patient?.mrn || visit.patientId}); print count: ${visit.printCount}.`, patient?.mrn, { printCount: previousCount }, { printCount: visit.printCount });
    clinicStore.broadcastUpdate('DOCUMENT_PRINTED', { documentType, documentId: visit.id });
    return res.json({ success: true, printCount: visit.printCount, action });
  }

  return res.status(400).json({ error: 'Unsupported document type.' });
});

// ----------------------------------------------------
// 2. PATIENT REGISTRATION & ALLERGIES
// ----------------------------------------------------
app.post('/api/patients', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { name, age, sex, phone, allergies } = req.body;

  if (!name || !age || !phone) {
    return res.status(400).json({ error: 'Name, age, and phone are required.' });
  }

  const nextSeq = clinicStore.patients.length + 1;
  const mrn = `PJ-${String(nextSeq).padStart(6, '0')}`;

  const newPatient: Patient = {
    id: `pat-${Date.now()}`,
    mrn,
    name: name.trim(),
    age: Number(age),
    sex: sex || 'Male',
    phone: phone.trim().startsWith('+91') ? phone.trim() : `+91 ${phone.trim()}`,
    allergies: allergies || [],
    pastHistory: '',
    registeredAt: new Date().toISOString(),
  };

  clinicStore.patients.unshift(newPatient);

  clinicStore.addAuditLog(
    role,
    userName,
    'REGISTER_PATIENT',
    `Patient: ${newPatient.name} (${newPatient.mrn})`,
    `Registered patient with MRN ${newPatient.mrn}, Phone: ${newPatient.phone}, Allergies: ${newPatient.allergies.join(', ') || 'None'}.`,
    newPatient.mrn,
    null,
    newPatient
  );

  clinicStore.broadcastUpdate('PATIENT_REGISTERED', { patient: newPatient });
  res.status(201).json(newPatient);
});

app.put('/api/patients/:id/discount', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  if (role !== 'admin') return res.status(403).json({ error: 'Only an administrator can grant patient discounts.' });
  const patient = clinicStore.patients.find((item) => item.id === req.params.id || item.mrn === req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });

  const { type, value, reason } = req.body;
  const amount = Number(value);
  const cleanReason = String(reason || '').trim();
  if (!['percentage', 'fixed'].includes(type) || !Number.isFinite(amount) || amount <= 0 || (type === 'percentage' && amount > 100)) {
    return res.status(400).json({ error: 'Enter a valid discount: fixed amount greater than ₹0 or percentage from 1 to 100.' });
  }
  if (!cleanReason) return res.status(400).json({ error: 'A discount reason is required.' });

  const before = patient.discount || null;
  patient.discount = { type, value: amount, reason: cleanReason, grantedBy: userName, grantedAt: new Date().toISOString(), remainingUses: 1 };
  clinicStore.addAuditLog(role, userName, 'GRANT_PATIENT_DISCOUNT', `Patient: ${patient.name} (${patient.mrn})`, `Granted one-time ${type === 'percentage' ? `${amount}%` : `₹${amount}`} discount for consultation, procedure, or lab billing only. Reason: ${cleanReason}.`, patient.mrn, before, patient.discount);
  clinicStore.broadcastUpdate('PATIENT_DISCOUNT_GRANTED', { patientId: patient.id });
  res.json({ success: true, patient });
});

app.patch('/api/patients/:id/allergies', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { id } = req.params;
  const { allergies } = req.body;

  const patient = clinicStore.patients.find((p) => p.id === id || p.mrn === id);
  if (!patient) return res.status(404).json({ error: `Patient not found with identifier "${id}".` });

  const oldAllergies = [...patient.allergies];
  const cleanedAllergies: string[] = Array.isArray(allergies)
    ? allergies.map((a: any) => String(a).trim()).filter(Boolean)
    : [];

  patient.allergies = cleanedAllergies;

  clinicStore.addAuditLog(
    role,
    userName,
    'UPDATE_ALLERGIES',
    `Patient: ${patient.name} (${patient.mrn})`,
    `Updated allergies from [${oldAllergies.join(', ') || 'None'}] to [${patient.allergies.join(', ') || 'None'}].`,
    patient.mrn,
    { allergies: oldAllergies },
    { allergies: patient.allergies }
  );

  clinicStore.broadcastUpdate('ALLERGIES_UPDATED', { patientId: patient.id, patientMrn: patient.mrn, allergies: patient.allergies });
  res.json({ success: true, patient, allergies: patient.allergies });
});

app.patch('/api/patients/:id/past-history', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { id } = req.params;
  const { pastHistory } = req.body;

  const patient = clinicStore.patients.find((p) => p.id === id || p.mrn === id);
  if (!patient) return res.status(404).json({ error: `Patient not found with identifier "${id}".` });

  const oldPastHistory = patient.pastHistory || '';
  const cleanedPastHistory = typeof pastHistory === 'string' ? pastHistory.trim() : '';

  patient.pastHistory = cleanedPastHistory;

  clinicStore.addAuditLog(
    role,
    userName,
    'UPDATE_PAST_HISTORY',
    `Patient: ${patient.name} (${patient.mrn})`,
    `Updated patient-level past medical history from [${oldPastHistory || 'None'}] to [${patient.pastHistory || 'None'}].`,
    patient.mrn,
    { pastHistory: oldPastHistory },
    { pastHistory: patient.pastHistory }
  );

  clinicStore.broadcastUpdate('PAST_HISTORY_UPDATED', { patientId: patient.id, patientMrn: patient.mrn, pastHistory: patient.pastHistory });
  res.json({ success: true, patient, pastHistory: patient.pastHistory });
});

// ----------------------------------------------------
// 3. TOKENS & CONSULTATION FEE (RECEPTION)
// ----------------------------------------------------
// Follow-up protocol: a patient who pays a consultation fee gets 14 days of
// free follow-up visits. Any visit within that window is billed ₹0. After the
// window expires, the next visit is a paid consultation which restarts the clock.
const FOLLOW_UP_DAYS = 14;

const parseClinicDate = (value: string): Date => new Date(`${value}T00:00:00Z`);

const isWithinFollowUpWindow = (patient: Patient, today: string): boolean => {
  if (!patient.followUpUntil) return false;
  return parseClinicDate(patient.followUpUntil).getTime() >= parseClinicDate(today).getTime();
};

const computeFollowUpUntil = (today: string): string => {
  const date = parseClinicDate(today);
  date.setUTCDate(date.getUTCDate() + FOLLOW_UP_DAYS);
  return date.toISOString().slice(0, 10);
};

app.post('/api/tokens', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { patientId, doctorId, reason, paymentMethod, upiRef } = req.body;

  const patient = clinicStore.patients.find((p) => p.id === patientId);
  const doctor = clinicStore.doctors.find((d) => d.id === doctorId);

  if (!patient || !doctor) {
    return res.status(400).json({ error: 'Valid patient and doctor are required.' });
  }

  // Calculate doctor's daily token sequence
  const docVisits = clinicStore.visits.filter((v) => v.doctorId === doctorId);
  const tokenSeq = docVisits.length + 1;
  const tokenNumber = `${doctor.tokenPrefix}-${String(tokenSeq).padStart(3, '0')}`;

  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);
  const { invoiceNo, ...documentAllocation } = clinicStore.allocateInvoiceNumber('REC', timestamp);

  // Find active reception shift
  const activeShift = clinicStore.shifts.find(
    (s) => s.department === 'reception' && s.status === 'open'
  ) || clinicStore.shifts.find((s) => s.department === 'reception') || clinicStore.shifts[0] || { shiftType: 'Shift A' as ShiftType };

  const isFollowUp = isWithinFollowUpWindow(patient, today);
  const consultationFee = isFollowUp ? 0 : doctor.consultationFee;

  const consultationBill: Bill = {
    id: `bill-${Date.now()}`,
    invoiceNo,
    ...documentAllocation,
    type: 'consultation',
    visitId: `vis-${Date.now()}`,
    patientId: patient.id,
    patientName: patient.name,
    patientMrn: patient.mrn,
    items: [
      {
        name: isFollowUp
          ? `${doctor.name} - Follow-up Consultation (Token ${tokenNumber}) [FREE - within 14-day window]`
          : `${doctor.name} - Consultation Fee (Token ${tokenNumber})`,
        qty: 1,
        unitPrice: consultationFee,
        total: consultationFee,
      },
    ],
    subtotal: consultationFee,
    tax: 0,
    total: consultationFee,
    paymentMethod: paymentMethod || 'cash',
    upiRef: upiRef || undefined,
    cashierName: userName,
    shift: activeShift.shiftType,
    timestamp,
    status: 'paid',
  };

  const newVisit: TokenVisit = {
    id: consultationBill.visitId,
    tokenNumber,
    patientId: patient.id,
    doctorId,
    reason: reason || 'Outpatient Consultation',
    fee: consultationFee,
    paymentMethod: paymentMethod || 'cash',
    upiRef: upiRef || undefined,
    cashierName: userName,
    shift: activeShift.shiftType,
    timestamp,
    status: 'waiting_doctor',
    consultationReceiptNo: invoiceNo,
    isFollowUp,
    followUpFreeUntil: patient.followUpUntil || undefined,
    stageHistory: [
      {
        stage: 'registered_token_paid',
        timestamp,
        actorName: userName,
        actorRole: 'Receptionist',
        notes: isFollowUp
          ? `Follow-up visit - consultation fee waived (₹0). Free follow-up window valid until ${patient.followUpUntil}.`
          : `Consultation fee ₹${doctor.consultationFee} received via ${(paymentMethod || 'cash').toUpperCase()}`,
      },
      {
        stage: 'waiting_doctor',
        timestamp,
        actorName: userName,
        actorRole: 'Receptionist',
        notes: `Token ${tokenNumber} issued and queued for ${doctor.name}`,
      },
    ],
    prescriptions: [],
    procedureOrders: [],
  };

  // A PAID consultation restarts the 14-day follow-up clock.
  if (!isFollowUp) {
    patient.lastConsultationDate = today;
    patient.followUpUntil = computeFollowUpUntil(today);
  }

  clinicStore.finalizeInvoiceDocument(consultationBill);
  clinicStore.bills.unshift(consultationBill);
  clinicStore.visits.unshift(newVisit);

  clinicStore.addAuditLog(
    role,
    userName,
    isFollowUp ? 'CREATE_TOKEN_FOLLOW_UP' : 'CREATE_TOKEN_PAYMENT',
    `Token: ${tokenNumber}`,
    isFollowUp
      ? `Free follow-up visit (₹0) issued for ${patient.name} (${patient.mrn}) with ${doctor.name}. Follow-up window valid until ${patient.followUpUntil}. Invoice: ${invoiceNo}`
      : `Consultation fee ₹${doctor.consultationFee} collected via ${(paymentMethod || 'cash').toUpperCase()}${upiRef ? ` (Ref: ${upiRef})` : ''}. Issued token ${tokenNumber} for ${patient.name} (${patient.mrn}) with ${doctor.name}. Follow-up window extended to ${patient.followUpUntil}. Invoice: ${invoiceNo}`,
    patient.mrn,
    null,
    { token: tokenNumber, invoiceNo, fee: consultationFee, isFollowUp, followUpUntil: patient.followUpUntil }
  );

  clinicStore.broadcastUpdate('TOKEN_CREATED', { visit: newVisit, bill: consultationBill });
  res.status(201).json({ visit: newVisit, bill: consultationBill });
});

// ----------------------------------------------------
// 4. DOCTOR CALL TOKEN & CONSULTATION
// ----------------------------------------------------
app.post('/api/tokens/:id/call', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { doctorId } = req.body;

  const doctor = clinicStore.doctors.find((d) => d.id === doctorId);
  if (!doctor) return res.status(400).json({ error: 'Doctor not found.' });

  // Check if doctor is already in a room
  const docRoom = clinicStore.rooms.find((r) => r.id === doctor.roomId && (r.occupiedByDoctorId === null || r.occupiedByDoctorId === doctorId));
  // Find the doctor's scheduled room if available, otherwise any free room
  const freeRoom = docRoom || clinicStore.rooms.find((r) => r.occupiedByDoctorId === null);

  if (!freeRoom) {
    return res.status(409).json({
      error: 'Both Room 1 and Room 2 are currently occupied! Please finish consultation in the occupied room first.',
    });
  }

  // Next waiting token for this doctor
  const visit = clinicStore.visits.find(
    (v) => v.id === req.params.id && v.status === 'waiting_doctor'
  );
  if (!visit) {
    return res.status(404).json({ error: 'Token not found in waiting queue.' });
  }

  const timestamp = new Date().toISOString();

  // Assign room
  freeRoom.occupiedByDoctorId = doctor.id;
  freeRoom.occupiedByDoctorName = doctor.name;
  freeRoom.currentTokenNumber = visit.tokenNumber;
  freeRoom.occupiedAt = timestamp;

  visit.status = 'with_doctor';
  visit.assignedRoom = freeRoom.name;
  visit.calledAt = timestamp;
  visit.stageHistory.push({
    stage: 'with_doctor',
    timestamp,
    actorName: userName,
    actorRole: 'Doctor',
    notes: `Called into ${freeRoom.name}`,
  });

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);

  clinicStore.addAuditLog(
    role,
    userName,
    'TOKEN_CALLED',
    `Token: ${visit.tokenNumber}`,
    `${doctor.name} called token ${visit.tokenNumber} into ${freeRoom.name}.`,
    patient?.mrn,
    { status: 'waiting_doctor' },
    { status: 'with_doctor', room: freeRoom.name }
  );

  clinicStore.broadcastUpdate('TOKEN_CALLED', {
    tokenNumber: visit.tokenNumber,
    room: freeRoom.name,
    doctorName: doctor.name,
  });

  res.json({ success: true, visit, room: freeRoom });
});

app.post('/api/tokens/:id/case-sheet', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);
  const oldSheet = visit.caseSheet;

  visit.caseSheet = {
    ...req.body,
    savedAt: new Date().toISOString(),
  };

  clinicStore.addAuditLog(
    role,
    userName,
    'SAVE_CASE_SHEET',
    `Token: ${visit.tokenNumber}`,
    `Saved clinical case sheet for ${patient?.name || 'patient'}. Diagnosis: "${visit.caseSheet?.diagnosis || 'Pending'}"`,
    patient?.mrn,
    oldSheet,
    visit.caseSheet
  );

  clinicStore.broadcastUpdate('CASE_SHEET_SAVED', { visitId: visit.id, caseSheet: visit.caseSheet });
  res.json(visit);
});

app.post('/api/tokens/:id/prescriptions', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);
  const { prescriptions } = req.body;

  const oldPrescriptions = [...(visit.prescriptions || [])];
  visit.prescriptions = prescriptions || [];

  // Check if any medicine dose or quantity was edited
  const doseChanges: string[] = [];
  visit.prescriptions.forEach((newMed) => {
    const oldMed = oldPrescriptions.find((o) => o.drugName === newMed.drugName);
    if (oldMed && oldMed.dose !== newMed.dose) {
      doseChanges.push(`${newMed.drugName}: dose "${oldMed.dose}" -> "${newMed.dose}"`);
    }
  });

  const isDoseEdit = doseChanges.length > 0;
  const actionName = isDoseEdit ? 'EDIT_PRESCRIPTION_DOSE' : 'UPDATE_PRESCRIPTIONS';
  const outsideCount = visit.prescriptions.filter((p) => p.isOutsideMedicine).length;
  const inHouseCount = visit.prescriptions.length - outsideCount;

  const detailMsg = isDoseEdit
    ? `Doctor edited dose: ${doseChanges.join('; ')}.`
    : `Doctor saved prescription (${visit.prescriptions.length} items: ${inHouseCount} clinic, ${outsideCount} outside) for ${patient?.name || 'patient'}.`;

  clinicStore.addAuditLog(
    role,
    userName,
    actionName,
    `Token: ${visit.tokenNumber}`,
    detailMsg,
    patient?.mrn,
    { count: oldPrescriptions.length, items: oldPrescriptions },
    { count: visit.prescriptions.length, items: visit.prescriptions }
  );

  clinicStore.broadcastUpdate('PRESCRIPTIONS_UPDATED', {
    visitId: visit.id,
    tokenNumber: visit.tokenNumber,
    prescriptions: visit.prescriptions,
  });

  res.json(visit);
});

app.post('/api/tokens/:id/procedures', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);
  const incomingOrders: PrescribedProcedure[] = req.body.procedureOrders || [];

  // Check rule: A GIVEN order cannot go back to UNBILLED or be deleted
  const existingGivenOrders = visit.procedureOrders.filter((p) => p.status === 'GIVEN' || p.nurseGiven);
  for (const given of existingGivenOrders) {
    const incomingMatch = incomingOrders.find((i) => i.procedureId === given.procedureId);
    if (!incomingMatch) {
      return res.status(400).json({
        error: `CANNOT REMOVE COMPLETED ORDER: Procedure "${given.name}" has already been GIVEN to the patient and cannot be deleted.`,
      });
    }
  }

  // Preserve existing status for orders
  const mergedOrders: PrescribedProcedure[] = incomingOrders.map((inc) => {
    const existing = visit.procedureOrders.find((p) => p.procedureId === inc.procedureId);
    if (existing) {
      if (existing.status === 'GIVEN' || existing.nurseGiven) {
        return {
          ...inc,
          status: 'GIVEN',
          billed: true,
          billInvoiceNo: existing.billInvoiceNo,
          nurseGiven: true,
          nurseGivenAt: existing.nurseGivenAt,
          nurseName: existing.nurseName,
          nurseNote: existing.nurseNote,
        };
      }
      if (existing.status === 'BILLED' || existing.billed) {
        return {
          ...inc,
          status: 'BILLED',
          billed: true,
          billInvoiceNo: existing.billInvoiceNo,
          nurseGiven: false,
        };
      }
    }

    // Newly prescribed procedure order: initial status is UNBILLED
    clinicStore.addAuditLog(
      role,
      userName,
      'ORDER_PROCEDURE',
      `Order: ${inc.name} (Token ${visit.tokenNumber})`,
      `Prescribed procedure order "${inc.name}" (Qty: ${inc.qty}) for ${patient?.name || 'patient'}. Status: UNBILLED.`,
      patient?.mrn,
      null,
      { status: 'UNBILLED', name: inc.name, qty: inc.qty, unitPrice: inc.unitPrice, totalPrice: inc.totalPrice }
    );

    return {
      ...inc,
      status: 'UNBILLED',
      billed: false,
      nurseGiven: false,
    };
  });

  visit.procedureOrders = mergedOrders;

  clinicStore.broadcastUpdate('PROCEDURES_UPDATED', { visitId: visit.id, procedureOrders: visit.procedureOrders });
  res.json(visit);
});

app.post('/api/tokens/:id/labs', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });
  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);
  const incomingOrders: PrescribedLabTest[] = req.body.labOrders || [];
  visit.labOrders = visit.labOrders || [];
  visit.labOrders = incomingOrders.map((inc) => {
    const existing = (visit.labOrders || []).find((item) => item.labTestId === inc.labTestId);
    if (existing?.billed) return { ...inc, status: existing.status, billed: true, billInvoiceNo: existing.billInvoiceNo, collected: existing.collected, reported: existing.reported };
    clinicStore.addAuditLog(role, userName, 'ORDER_LAB_TEST', `Lab test: ${inc.name} (Token ${visit.tokenNumber})`, `Doctor ordered laboratory test "${inc.name}" for ${patient?.name || 'patient'}.`, patient?.mrn, null, { status: 'UNBILLED', name: inc.name, totalPrice: inc.totalPrice });
    return { ...inc, status: 'UNBILLED', billed: false, collected: false, reported: false };
  });
  clinicStore.broadcastUpdate('LAB_ORDERS_UPDATED', { visitId: visit.id, labOrders: visit.labOrders });
  res.json(visit);
});

app.post('/api/tokens/:id/finish-consultation', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.id);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const timestamp = new Date().toISOString();
  let nextStage: PatientStage = 'completed';
  let nextNotes = 'Consultation completed.';

  const hasUnbilledProcedures = visit.procedureOrders.some((procedure) => procedure.status === 'UNBILLED' || (!procedure.billed && procedure.status !== 'GIVEN'));
  const hasUnbilledLabs = (visit.labOrders || []).some((lab) => lab.status === 'UNBILLED' || (!lab.billed && lab.status !== 'REPORTED'));
  const hasProcedures = visit.procedureOrders.length > 0;
  const hasInHousePharmacyMeds = visit.prescriptions.some((p) => !p.isOutsideMedicine && !p.dispensed);

  if (hasUnbilledProcedures || hasUnbilledLabs) {
    nextStage = 'procedure_billing_pending';
    nextNotes = 'Sent to reception counter for combined procedure and laboratory billing.';
  } else if (hasProcedures && visit.procedureOrders.some((p) => !p.nurseGiven)) {
    nextStage = 'nurse_check_pending';
    nextNotes = 'Sent to treatment room for nurse execution.';
  } else if (hasInHousePharmacyMeds) {
    nextStage = 'waiting_pharmacy';
    nextNotes = 'Sent to pharmacy counter for medicine dispensing.';
  }

  // Release room
  clinicStore.rooms.forEach((r) => {
    if (r.currentTokenNumber === visit.tokenNumber || r.occupiedByDoctorId === visit.doctorId) {
      r.occupiedByDoctorId = null;
      r.occupiedByDoctorName = null;
      r.currentTokenNumber = null;
      r.occupiedAt = null;
    }
  });

  visit.status = nextStage;
  if (nextStage === 'completed') visit.completedAt = timestamp;
  visit.stageHistory.push({
    stage: nextStage,
    timestamp,
    actorName: userName,
    actorRole: 'Doctor',
    notes: nextNotes,
  });

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);

  clinicStore.addAuditLog(
    role,
    userName,
    'FINISH_CONSULTATION',
    `Token: ${visit.tokenNumber}`,
    `Doctor finished consultation. Room released. Routed to stage: ${nextStage}.`,
    patient?.mrn,
    { status: 'with_doctor' },
    { status: nextStage }
  );

  clinicStore.broadcastUpdate('CONSULTATION_FINISHED', { visitId: visit.id, nextStage });
  res.json({ success: true, visit, nextStage });
});

// ----------------------------------------------------
// 5A. STANDALONE WALK-IN LAB BILLING
// ----------------------------------------------------
app.post('/api/bills/lab/walk-in', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { patientId, name, age, sex, phone, labTestIds, paymentMethod, upiRef } = req.body;
  if (!Array.isArray(labTestIds) || labTestIds.length === 0) return res.status(400).json({ error: 'Select at least one laboratory test.' });

  let patient = patientId ? clinicStore.patients.find((p) => p.id === patientId) : undefined;
  if (!patient) {
    if (!name?.trim() || !age || !phone?.trim()) return res.status(400).json({ error: 'Patient name, age, and phone are required for a walk-in lab bill.' });
    patient = {
      id: `pat-${Date.now()}`,
      mrn: `PJ-${String(clinicStore.patients.length + 1).padStart(6, '0')}`,
      name: name?.trim() || 'Walk-in Customer', age: Number(age) || 0, sex: sex || 'Male',
      phone: phone.trim().startsWith('+91') ? phone.trim() : `+91 ${phone.trim()}`,
      allergies: [], pastHistory: '', registeredAt: new Date().toISOString(),
    };
    clinicStore.patients.unshift(patient);
    clinicStore.addAuditLog(role, userName, 'REGISTER_WALK_IN_LAB_PATIENT', `Patient: ${patient.name} (${patient.mrn})`, 'Walk-in patient registered for laboratory billing without consultation.', patient.mrn, null, patient);
  }

  const tests = labTestIds.map((id: string) => clinicStore.labTests.find((test) => test.id === id)).filter(Boolean) as typeof clinicStore.labTests;
  if (tests.length !== labTestIds.length) return res.status(400).json({ error: 'One or more selected laboratory tests are invalid.' });
  const timestamp = new Date().toISOString();
  const { invoiceNo, ...documentAllocation } = clinicStore.allocateInvoiceNumber('LAB', timestamp);
  const activeShift = clinicStore.shifts.find((s) => s.department === 'reception' && s.status === 'open') || clinicStore.shifts[0];
  const labOrders: PrescribedLabTest[] = tests.map((test) => ({
    labTestId: test.id, name: test.name, unitPrice: test.price, qty: 1, totalPrice: test.price,
    status: 'BILLED', billInvoiceNo: invoiceNo, billed: true, collected: false, reported: false,
  }));
  const subtotal = labOrders.reduce((sum, item) => sum + item.totalPrice, 0);
  const labVisit: TokenVisit = {
    id: `lab-vis-${Date.now()}`, tokenNumber: `LAB-${String(clinicStore.visits.filter((v) => v.tokenNumber.startsWith('LAB-')).length + 1).padStart(3, '0')}`,
    patientId: patient.id, doctorId: 'doc-1', reason: 'Walk-in laboratory testing', fee: 0,
    paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined, cashierName: userName,
    shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'completed', completedAt: timestamp,
    stageHistory: [{ stage: 'completed', timestamp, actorName: userName, actorRole: 'Receptionist', notes: 'Standalone walk-in laboratory bill issued; no consultation required.' }],
    prescriptions: [], procedureOrders: [], labOrders, consultationReceiptNo: invoiceNo,
  };
  const labBill: Bill = {
    id: `bill-${Date.now()}`, invoiceNo, ...documentAllocation, type: 'lab', visitId: labVisit.id, patientId: patient.id,
    patientName: patient.name, patientMrn: patient.mrn,
    items: labOrders.map((item) => ({ name: item.name, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
    subtotal, tax: 0, total: subtotal, paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined,
    cashierName: userName, shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid',
  };
  clinicStore.visits.unshift(labVisit);
  clinicStore.finalizeInvoiceDocument(labBill);
  clinicStore.bills.unshift(labBill);
  clinicStore.addAuditLog(role, userName, 'BILL_WALK_IN_LABS', `Invoice: ${invoiceNo}`, `Standalone walk-in laboratory bill ₹${subtotal} paid via ${(paymentMethod || 'cash').toUpperCase()} for ${patient.name}. Tests: ${labOrders.map((item) => item.name).join(', ')}`, patient.mrn, null, { invoiceNo, total: subtotal, labVisitId: labVisit.id });
  clinicStore.broadcastUpdate('WALK_IN_LAB_BILLED', { bill: labBill, visitId: labVisit.id, invoiceNo });
  res.status(201).json({ bill: labBill, visit: labVisit, patient });
});

// ----------------------------------------------------
// 5. PROCEDURE BILLING (RECEPTION SECOND VISIT)
// ----------------------------------------------------
app.post('/api/bills/procedure', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId, paymentMethod, upiRef, discountReason } = req.body;
  const requestedDiscount = Number(req.body.discountAmount || 0);
  const visit = clinicStore.visits.find((v) => v.id === visitId);
  const patient = clinicStore.patients.find((p) => p.id === visit?.patientId);
  if (!visit || !patient) return res.status(400).json({ error: 'Visit or patient not found.' });

  visit.labOrders = visit.labOrders || [];
  const unbilledProcedures = visit.procedureOrders.filter((p) => p.status === 'UNBILLED' || (!p.billed && p.status !== 'GIVEN'));
  const unbilledLabs = visit.labOrders.filter((lab) => lab.status === 'UNBILLED' || (!lab.billed && lab.status !== 'REPORTED'));
  if (!unbilledProcedures.length && !unbilledLabs.length) return res.status(400).json({ error: 'No unbilled procedure or laboratory items on this visit.' });

  const timestamp = new Date().toISOString();
  const { invoiceNo, ...documentAllocation } = clinicStore.allocateInvoiceNumber('REC', timestamp);
  const billingItems = [
    ...unbilledProcedures.map((item) => ({ name: `[Procedure] ${item.name}`, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
    ...unbilledLabs.map((item) => ({ name: `[Lab] ${item.name}`, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
  ];
  const subtotal = billingItems.reduce((sum, item) => sum + item.total, 0);
  const grant = patient.discount?.remainingUses ? patient.discount : undefined;
  if (requestedDiscount > 0 && !grant && role !== 'admin') return res.status(403).json({ error: 'Only an administrator can apply an ad-hoc discount.' });
  if (grant && requestedDiscount > 0) return res.status(400).json({ error: 'A saved patient discount is already available; do not submit an additional discount.' });
  if (requestedDiscount < 0 || requestedDiscount > subtotal) return res.status(400).json({ error: 'Discount must be between ₹0 and the bill subtotal.' });
  if (requestedDiscount > 0 && !String(discountReason || '').trim()) return res.status(400).json({ error: 'A discount reason is required.' });
  const discountAmount = grant ? Math.min(subtotal, grant.type === 'percentage' ? subtotal * grant.value / 100 : grant.value) : requestedDiscount;
  const appliedDiscountReason = grant?.reason || (discountAmount > 0 ? String(discountReason).trim() : undefined);
  const total = Math.max(0, subtotal - discountAmount);
  const activeShift = clinicStore.shifts.find((s) => s.department === 'reception' && s.status === 'open') || clinicStore.shifts[0];

  const combinedBill: Bill = {
    id: `bill-${Date.now()}`, invoiceNo, ...documentAllocation, type: 'procedure', visitId: visit.id, patientId: patient.id,
    patientName: patient.name, patientMrn: patient.mrn, items: billingItems, subtotal, discountAmount, discountReason: appliedDiscountReason, tax: 0, total,
    paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined, cashierName: userName,
    shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid'
  };

  if (grant) {
    grant.remainingUses = 0;
    clinicStore.addAuditLog(role, userName, 'APPLY_PATIENT_DISCOUNT', `Invoice: ${invoiceNo}`, `Applied ₹${discountAmount.toFixed(2)} patient discount to procedure/lab invoice ${invoiceNo}. Grant reason: ${grant.reason}.`, patient.mrn, { remainingUses: 1 }, { remainingUses: 0, discountAmount, invoiceNo });
  }
  unbilledProcedures.forEach((p) => { p.status = 'BILLED'; p.billed = true; p.billInvoiceNo = invoiceNo; });
  unbilledLabs.forEach((lab) => {
    lab.status = 'BILLED'; lab.billed = true; lab.billInvoiceNo = invoiceNo;
    clinicStore.addAuditLog(role, userName, 'BILL_LAB_ORDER', `Lab test: ${lab.name} (Token ${visit.tokenNumber})`, `Lab test "${lab.name}" billed on invoice ${invoiceNo}.`, patient.mrn, { status: 'UNBILLED' }, { status: 'BILLED', billInvoiceNo: invoiceNo });
  });

  const nextStage: PatientStage = unbilledProcedures.length > 0
    ? 'nurse_check_pending'
    : (visit.prescriptions.some((p) => !p.isOutsideMedicine && !p.dispensed) ? 'waiting_pharmacy' : 'completed');
  visit.status = nextStage;
  visit.procedureBillId = invoiceNo;
  visit.stageHistory.push({ stage: nextStage, timestamp, actorName: userName, actorRole: 'Receptionist', notes: `Combined procedure/lab invoice ${invoiceNo} (₹${subtotal}) collected via ${(paymentMethod || 'cash').toUpperCase()}.` });
  clinicStore.finalizeInvoiceDocument(combinedBill);
  clinicStore.bills.unshift(combinedBill);
  clinicStore.addAuditLog(role, userName, 'BILL_PROCEDURES_AND_LABS', `Invoice: ${invoiceNo}`, `Combined procedure/lab bill ₹${subtotal}${discountAmount > 0 ? ` less ₹${discountAmount} discount (${String(discountReason).trim()})` : ''}; net ₹${total} paid via ${(paymentMethod || 'cash').toUpperCase()} for token ${visit.tokenNumber} (${patient.name}).`, patient.mrn, null, { invoiceNo, subtotal, discountAmount, discountReason: discountAmount > 0 ? String(discountReason).trim() : undefined, total });
  clinicStore.broadcastUpdate('PROCEDURE_AND_LAB_BILLED', { bill: combinedBill, visitId: visit.id, invoiceNo });
  res.status(201).json({ bill: combinedBill, visit });
});

// ----------------------------------------------------
// LABORATORY RESULT WORKFLOW
// ----------------------------------------------------
app.post('/api/labs/:visitId/:labTestId/collected', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.visitId);
  const lab = visit?.labOrders?.find((item) => item.labTestId === req.params.labTestId);
  if (!visit || !lab) return res.status(404).json({ error: 'Visit or laboratory order not found.' });
  if (!lab.billed) return res.status(400).json({ error: 'Laboratory test must be billed before sample collection.' });
  lab.status = lab.reported ? 'REPORTED' : 'COLLECTED'; lab.collected = true;
  clinicStore.addAuditLog(role, userName, 'COLLECT_LAB_SAMPLE', `Lab test: ${lab.name} (Token ${visit.tokenNumber})`, `Sample collected for laboratory test "${lab.name}".`, undefined, { collected: false }, { collected: true });
  clinicStore.broadcastUpdate('LAB_SAMPLE_COLLECTED', { visitId: visit.id, labTestId: lab.labTestId });
  res.json({ success: true, visit });
});

app.post('/api/labs/:visitId/:labTestId/report', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const visit = clinicStore.visits.find((v) => v.id === req.params.visitId);
  const lab = visit?.labOrders?.find((item) => item.labTestId === req.params.labTestId);
  if (!visit || !lab) return res.status(404).json({ error: 'Visit or laboratory order not found.' });
  if (!lab.billed) return res.status(400).json({ error: 'Laboratory test must be billed before reporting.' });
  const { resultSummary = '', resultAttachment = '' } = req.body;
  if (!resultSummary.trim() && !resultAttachment.trim()) return res.status(400).json({ error: 'Enter a result summary or attach a result reference.' });
  lab.status = 'REPORTED'; lab.collected = true; lab.reported = true;
  lab.resultSummary = resultSummary.trim() || undefined;
  lab.resultAttachment = resultAttachment.trim() || undefined;
  lab.reportedAt = new Date().toISOString(); lab.reportedBy = userName;
  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);
  clinicStore.addAuditLog(role, userName, 'UPLOAD_LAB_RESULT', `Lab test: ${lab.name} (Token ${visit.tokenNumber})`, `Laboratory result uploaded for "${lab.name}".`, patient?.mrn, { reported: false }, { reported: true });
  clinicStore.broadcastUpdate('LAB_RESULT_REPORTED', { visitId: visit.id, labTestId: lab.labTestId });
  res.json({ success: true, visit });
});

// ----------------------------------------------------
// 6. NURSE CHECK & EXECUTION
// ----------------------------------------------------
app.post('/api/procedures/:visitId/:procedureId/given', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId, procedureId } = req.params;
  const { note } = req.body;

  const visit = clinicStore.visits.find((v) => v.id === visitId);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const proc = visit.procedureOrders.find((p) => p.procedureId === procedureId);
  if (!proc) return res.status(404).json({ error: 'Procedure order not found.' });

  const currentStatus = proc.status || (proc.nurseGiven ? 'GIVEN' : proc.billed ? 'BILLED' : 'UNBILLED');

  // Rule: A GIVEN order cannot be given again or go back to UNBILLED
  if (currentStatus === 'GIVEN') {
    return res.status(400).json({
      error: `ALREADY ADMINISTERED: Procedure "${proc.name}" has already been GIVEN.`,
    });
  }

  // STAGE A RULE: Must be BILLED before it can be GIVEN!
  if (currentStatus !== 'BILLED') {
    return res.status(400).json({
      error: `CANNOT ADMINISTER UNBILLED ITEM: "${proc.name}" has status "${currentStatus}". Reception procedure billing is required before administration!`,
    });
  }

  // Cross-check: Mismatch with billed invoice check
  const procBill = clinicStore.bills.find(
    (b) => b.type === 'procedure' && (b.visitId === visit.id || b.invoiceNo === visit.procedureBillId || b.invoiceNo === proc.billInvoiceNo)
  );
  if (!procBill) {
    return res.status(400).json({
      error: `BILL MISMATCH: No matching procedure invoice found for token ${visit.tokenNumber}!`,
    });
  }

  const billedItem = getBilledItem(procBill.items, proc.name);
  if (!billedItem || billedItem.qty < proc.qty) {
    return res.status(400).json({
      error: `QUANTITY MISMATCH: Prescribed ${proc.qty} of ${proc.name}, but invoice shows ${billedItem ? billedItem.qty : 0}. Reception must correct before administration.`,
    });
  }

  const timestamp = new Date().toISOString();
  const beforeStatus = proc.status;
  proc.status = 'GIVEN';
  proc.nurseGiven = true;
  proc.nurseGivenAt = timestamp;
  proc.nurseName = userName;
  proc.nurseNote = note || 'Administered as per physician prescription';

  // Check if all procedures are given
  const allDone = visit.procedureOrders.every((p) => p.status === 'GIVEN' || p.nurseGiven);
  if (allDone) {
    const hasPharmacyMeds = visit.prescriptions.some((p) => !p.isOutsideMedicine && !p.dispensed);
    const nextStage: PatientStage = hasPharmacyMeds ? 'waiting_pharmacy' : 'completed';
    visit.status = nextStage;
    if (nextStage === 'completed') visit.completedAt = timestamp;

    visit.stageHistory.push({
      stage: 'procedures_done',
      timestamp,
      actorName: userName,
      actorRole: 'Nurse',
      notes: `All procedure items completed. Next: ${hasPharmacyMeds ? 'Pharmacy' : 'Journey Completed'}.`,
    });
  }

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);

  clinicStore.addAuditLog(
    role,
    userName,
    'GIVE_PROCEDURE_ORDER',
    `Order: ${proc.name} (Token ${visit.tokenNumber})`,
    `Order "${proc.name}" status changed from ${beforeStatus} to GIVEN by Nurse ${userName}.${note ? ` Note: ${note}` : ''}`,
    patient?.mrn,
    { status: beforeStatus, billInvoiceNo: proc.billInvoiceNo },
    { status: 'GIVEN', billInvoiceNo: proc.billInvoiceNo, administeredBy: userName, administeredAt: timestamp }
  );

  clinicStore.broadcastUpdate('PROCEDURE_GIVEN', { visitId, procedureId });
  res.json({ success: true, visit, allDone });
});

app.post('/api/procedures/:visitId/:procedureId/not-given', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId, procedureId } = req.params;
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Reason for not giving procedure is required.' });
  }

  const visit = clinicStore.visits.find((v) => v.id === visitId);
  const proc = visit?.procedureOrders.find((p) => p.procedureId === procedureId);
  if (!visit || !proc) return res.status(404).json({ error: 'Order not found.' });

  // Rule: A GIVEN order cannot go back to UNBILLED or be reversed
  if (proc.status === 'GIVEN') {
    return res.status(400).json({
      error: `CANNOT REVERT GIVEN ORDER: Procedure "${proc.name}" was already administered. A GIVEN order cannot go back to UNBILLED.`,
    });
  }

  proc.nurseGiven = false;
  proc.nurseNote = `NOT GIVEN: ${reason.trim()}`;
  proc.nurseName = userName;

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);

  clinicStore.addAuditLog(
    role,
    userName,
    'NURSE_PROCEDURE_NOT_GIVEN',
    `Token: ${visit.tokenNumber}`,
    `Nurse ${userName} recorded NOT GIVEN for "${proc.name}". Reason: ${reason}`,
    patient?.mrn,
    null,
    { procedureId, reason }
  );

  clinicStore.broadcastUpdate('PROCEDURE_NOT_GIVEN', { visitId, procedureId });
  res.json({ success: true, visit });
});

// ----------------------------------------------------
// 7. PHARMACY BATCH DISPENSING & BILLING
// ----------------------------------------------------
app.post('/api/pharmacy/dispense', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId, medicineIndex, qty } = req.body;

  const visit = clinicStore.visits.find((v) => v.id === visitId);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });

  const med = visit.prescriptions[medicineIndex];
  if (!med) return res.status(404).json({ error: 'Medicine index invalid.' });

  if (med.isOutsideMedicine) {
    return res.status(400).json({ error: 'This is an outside medicine prescribed for retail purchase.' });
  }

  const qtyToDispense = Number(qty) || med.qtyToDispense || 1;
  const catalogDrug = clinicStore.drugs.find((d) => d.id === med.drugId || d.name === med.drugName);

  if (!catalogDrug) {
    return res.status(404).json({ error: 'Drug not found in catalogue.' });
  }

  // STAGE 5 FEFO BATCH SELECTION & EXPIRY RULES
  const nextBatch = clinicStore.getNextFefoBatch(catalogDrug.id);
  if (!nextBatch) {
    return res.status(400).json({
      error: `OUT OF STOCK: No valid, unexpired stock batch available for ${catalogDrug.name}.`,
    });
  }

  // EXPIRED CHECK (BLOCKED COMPLETELY)
  if (clinicStore.isExpired(nextBatch.expiryDate)) {
    return res.status(403).json({
      error: `EXPIRY LOCK: Batch ${nextBatch.batchNumber} of ${catalogDrug.name} expired on ${nextBatch.expiryDate}. Expired batches are blocked from dispensing!`,
    });
  }

  if (nextBatch.quantity < qtyToDispense) {
    return res.status(400).json({
      error: `INSUFFICIENT BATCH STOCK: Batch ${nextBatch.batchNumber} has only ${nextBatch.quantity} units (requested ${qtyToDispense}).`,
    });
  }

  // Deduct from batch
  nextBatch.quantity -= qtyToDispense;

  const timestamp = new Date().toISOString();
  med.dispensed = true;
  med.qtyDispensed = qtyToDispense;
  med.dispensedAt = timestamp;
  med.dispensedBy = userName;
  med.dispensedBatchNumber = nextBatch.batchNumber;
  med.dispensedBatchExpiry = nextBatch.expiryDate;

  const patient = clinicStore.patients.find((p) => p.id === visit.patientId);

  clinicStore.addAuditLog(
    role,
    userName,
    'DISPENSE_PHARMACY',
    `Drug: ${med.drugName} (Batch ${nextBatch.batchNumber})`,
    `Dispensed ${qtyToDispense} units from Batch ${nextBatch.batchNumber} (Expires ${nextBatch.expiryDate}) to Token ${visit.tokenNumber} (${patient?.name}). Batch stock remaining: ${nextBatch.quantity}.`,
    patient?.mrn,
    { batchNumber: nextBatch.batchNumber, qtyBefore: nextBatch.quantity + qtyToDispense },
    { batchNumber: nextBatch.batchNumber, qtyAfter: nextBatch.quantity }
  );

  clinicStore.broadcastUpdate('PHARMACY_DISPENSED', { visitId, medicineIndex });
  res.json({ success: true, visit, batchUsed: nextBatch });
});

app.post('/api/pharmacy/cancel', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId } = req.body;
  const visit = clinicStore.visits.find((v) => v.id === visitId);
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });
  if (visit.pharmacyBillId) {
    return res.status(400).json({ error: 'This pharmacy bill has already been generated and cannot be cancelled here.' });
  }

  const dispensedMeds = visit.prescriptions.filter((med) => med.dispensed && !med.isOutsideMedicine);
  if (dispensedMeds.length === 0) {
    return res.status(400).json({ error: 'There are no dispensed medicines to cancel.' });
  }

  let restoredQty = 0;
  dispensedMeds.forEach((med) => {
    const qty = med.qtyDispensed || med.qtyToDispense || 1;
    const batch = clinicStore.batches.find((b) =>
      b.batchNumber === med.dispensedBatchNumber &&
      (b.drugId === med.drugId || b.drugName === med.drugName)
    );
    if (batch) {
      batch.quantity += qty;
      if (batch.quantity > 0 && batch.status === 'depleted') batch.status = 'active';
      restoredQty += qty;
    }

    med.dispensed = false;
    med.qtyDispensed = 0;
    med.dispensedAt = undefined;
    med.dispensedBy = undefined;
    med.dispensedBatchNumber = undefined;
    med.dispensedBatchExpiry = undefined;
  });

  clinicStore.addAuditLog(
    role,
    userName,
    'CANCEL_PHARMACY_DISPENSE',
    `Token: ${visit.tokenNumber}`,
    `Cancelled unpaid pharmacy dispensing and returned ${restoredQty} units to stock.`,
    clinicStore.patients.find((p) => p.id === visit.patientId)?.mrn,
    { visitId },
    { restoredQty }
  );
  clinicStore.broadcastUpdate('PHARMACY_DISPENSE_CANCELLED', { visitId });
  res.json({ success: true, visit, restoredQty });
});

app.post('/api/pharmacy/bill', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { visitId, paymentMethod, upiRef } = req.body;

  const visit = clinicStore.visits.find((v) => v.id === visitId);
  const patient = clinicStore.patients.find((p) => p.id === visit?.patientId);
  if (!visit || !patient) return res.status(404).json({ error: 'Visit or patient not found.' });

  const billableMeds = visit.prescriptions.filter((p) => !p.isOutsideMedicine && p.dispensed);
  if (billableMeds.length === 0) {
    return res.status(400).json({ error: 'No dispensed clinic medicines available to bill.' });
  }

  const timestamp = new Date().toISOString();
  const { invoiceNo, ...documentAllocation } = clinicStore.allocateInvoiceNumber('PHM', timestamp);

  const items = billableMeds.map((m) => ({
    name: `${m.drugName} (${m.strength}) [Batch: ${m.dispensedBatchNumber || 'FEFO'}]`,
    qty: m.qtyDispensed || m.qtyToDispense || 1,
    unitPrice: m.unitPrice || 0,
    total: (m.qtyDispensed || m.qtyToDispense || 1) * (m.unitPrice || 0),
    dose: m.dose || '',
    duration: m.duration || '',
  }));

  const subtotal = items.reduce((acc, i) => acc + i.total, 0);

  const activeShift = clinicStore.shifts.find(
    (s) => s.department === 'pharmacy' && s.status === 'open'
  ) || clinicStore.shifts.find((s) => s.department === 'pharmacy') || clinicStore.shifts[1] || clinicStore.shifts[0] || { shiftType: 'Shift A' as ShiftType };

  const pharmacyBill: Bill = {
    id: `bill-${Date.now()}`,
    invoiceNo,
    ...documentAllocation,
    type: 'pharmacy',
    visitId: visit.id,
    patientId: patient.id,
    patientName: patient.name,
    patientMrn: patient.mrn,
    items,
    subtotal,
    tax: 0,
    total: subtotal,
    paymentMethod: paymentMethod || 'cash',
    upiRef: upiRef || undefined,
    cashierName: userName,
    shift: activeShift.shiftType,
    timestamp,
    status: 'paid',
  };

  visit.status = 'completed';
  visit.completedAt = timestamp;
  visit.pharmacyBillId = invoiceNo;
  visit.stageHistory.push({
    stage: 'completed',
    timestamp,
    actorName: userName,
    actorRole: 'Pharmacist',
    notes: `Pharmacy bill ${invoiceNo} paid (₹${subtotal} via ${(paymentMethod || 'cash').toUpperCase()}). Patient journey completed.`,
  });

  clinicStore.finalizeInvoiceDocument(pharmacyBill);
  clinicStore.bills.unshift(pharmacyBill);

  clinicStore.addAuditLog(
    role,
    userName,
    'BILL_PHARMACY',
    `Invoice: ${invoiceNo}`,
    `Pharmacy invoice ${invoiceNo} generated for ₹${subtotal} via ${(paymentMethod || 'cash').toUpperCase()} for token ${visit.tokenNumber} (${patient.name}). Items: ${items.map((i) => i.name).join(', ')}`,
    patient.mrn,
    null,
    { invoiceNo, total: subtotal }
  );

  clinicStore.broadcastUpdate('PHARMACY_BILLED', { bill: pharmacyBill, visit });
  res.status(201).json({ bill: pharmacyBill, visit });
});

// ----------------------------------------------------
// RETAIL PHARMACY: OUTSIDE CUSTOMER BILLING
// ----------------------------------------------------
app.post('/api/pharmacy/bill-retail', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { patientId, name, age, sex, phone, items, paymentMethod, upiRef } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'Add at least one medicine.' });

  if (paymentMethod === 'upi' && !String(upiRef || '').trim()) {
    return res.status(400).json({ error: 'UPI transaction reference is required.' });
  }

  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);
  const requestedTotals = new Map<string, number>();
  const billItems: Bill['items'] = [];

  // Preflight every item and all stock before creating the patient or changing inventory.
  for (const requested of items) {
    const qty = Number(requested.qty);
    const drug = clinicStore.drugs.find((d) => d.id === requested.drugId);
    if (!drug || !Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid medicine or quantity.' });
    const dosage = String(requested.dosage || '').trim();
    if (!/^\d+-\d+-\d+$/.test(dosage)) return res.status(400).json({ error: `Dosage for ${drug.name} must be in 0-0-0 format.` });
    requestedTotals.set(drug.id, (requestedTotals.get(drug.id) || 0) + qty);
    const days = Math.max(1, Number(requested.days) || 1);
    const total = qty * Number(drug.unitPrice || 0);
    billItems.push({ drugId: drug.id, name: `${drug.name} ${drug.strength}`.trim(), qty, unitPrice: Number(drug.unitPrice || 0), total, dose: dosage, duration: `${days} day${days === 1 ? '' : 's'}` });
  }

  const preparedBatches = new Map<string, typeof clinicStore.batches>();
  for (const [drugId, qty] of requestedTotals.entries()) {
    const drug = clinicStore.drugs.find((d) => d.id === drugId);
    const batches = clinicStore.batches
      .filter((b) => b.drugId === drugId && b.status !== 'written_off' && !b.isWrittenOff && b.quantity > 0 && b.expiryDate >= today)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const available = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (available < qty) return res.status(400).json({ error: `Insufficient stock for ${drug?.name || 'medicine'}. Available: ${available}, requested: ${qty}.` });
    preparedBatches.set(drugId, batches);
  }

  let patient = patientId ? clinicStore.patients.find((p) => p.id === patientId) : undefined;
  if (!patient) {
    if (!phone?.trim()) return res.status(400).json({ error: 'Outside customer mobile number is required.' });
    patient = {
      id: `pat-retail-${Date.now()}`,
      mrn: `PJ-${String(clinicStore.patients.length + 1).padStart(6, '0')}`,
      name: name?.trim() || 'Walk-in Customer', age: Number(age) || 0, sex: sex || 'Male',
      phone: phone.trim().startsWith('+91') ? phone.trim() : `+91 ${phone.trim()}`,
      allergies: [], pastHistory: '', registeredAt: new Date().toISOString(),
    };
    clinicStore.patients.unshift(patient);
  }

  const stockDeductions: { drugId: string; drugName: string; batchId: string; batchNumber: string; qty: number }[] = [];
  // Payment has succeeded when this endpoint is reached; now apply FEFO stock deductions atomically per requested item.
  for (const [drugId, qty] of requestedTotals.entries()) {
    const drug = clinicStore.drugs.find((d) => d.id === drugId)!;
    let remaining = qty;
    for (const batch of preparedBatches.get(drugId) || []) {
      if (remaining <= 0) break;
      const taken = Math.min(batch.quantity, remaining);
      batch.quantity -= taken;
      remaining -= taken;
      stockDeductions.push({ drugId: drug.id, drugName: drug.name, batchId: batch.id, batchNumber: batch.batchNumber, qty: taken });
    }
  }

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const { invoiceNo, ...documentAllocation } = clinicStore.allocateInvoiceNumber('RPM', timestamp);
  const activeShift = clinicStore.shifts.find((s) => s.department === 'pharmacy' && s.status === 'open') || clinicStore.shifts.find((s) => s.department === 'pharmacy') || clinicStore.shifts[0];
  const bill: Bill = {
    id: `bill-${Date.now()}`, invoiceNo, ...documentAllocation, type: 'pharmacy', visitId: `retail-vis-${Date.now()}`,
    patientId: patient.id, patientName: patient.name, patientMrn: patient.mrn,
    items: billItems, subtotal, tax: 0, total: subtotal,
    paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined,
    cashierName: userName, shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid', stockDeductions,
  };
  clinicStore.finalizeInvoiceDocument(bill);
  clinicStore.bills.unshift(bill);
  clinicStore.addAuditLog(role, userName, 'BILL_RETAIL_PHARMACY', `Invoice: ${invoiceNo}`, `Retail pharmacy invoice ${invoiceNo} for ${patient.name} (${patient.mrn}) total ₹${subtotal}. FEFO deductions: ${stockDeductions.map((d) => `${d.drugName} ${d.batchNumber} x${d.qty}`).join(', ')}`, patient.mrn, null, { invoiceNo, total: subtotal, stockDeductions });
  clinicStore.broadcastUpdate('RETAIL_PHARMACY_BILLED', { bill });
  res.status(201).json({ bill });
});

app.post('/api/pharmacy/return-items', (req: Request, res: Response) => {
  req.body = { ...req.body, fullRefund: req.body.fullRefund === true || (req.body.amount !== undefined && Number(req.body.amount) === Number(clinicStore.bills.find((b) => b.id === req.body.billId)?.total)) };
  createRefundRequest(req, res);
});

const approveRefund = (req: Request, res: Response) => {
  const { role, userName, userId } = getUserContext(req);
  const { id, billId } = req.params;
  const bill = clinicStore.bills.find((b) => b.id === (billId || req.body?.billId));
  const refund = bill?.refunds?.find((r) => r.id === id);
  if (!bill || !refund) return res.status(404).json({ error: 'Refund not found.' });
  if (!['accounts', 'admin'].includes(role)) return res.status(403).json({ error: 'Refund approval requires an authenticated Accounts or Admin approver.' });
  if (refund.status !== 'pending') return res.status(409).json({ error: `Refund is already ${refund.status}.` });

  const creatorId = refund.createdByUserId;
  if (creatorId === userId) return res.status(403).json({ error: 'Segregation of duties violation: the refund creator cannot approve it.' });

  let restored: { drugName: string; batchNumber: string; qty: number }[] = [];
  if (bill.type === 'pharmacy') {
    const addedStock: { batch: any; qty: number }[] = [];
    const allocatedThisRefund = new Map<string, number>();
    for (const returned of refund.items) {
      const item = bill.items[returned.itemIndex];
      if (!item) return res.status(400).json({ error: 'A refunded item no longer exists on the invoice.' });
      let remaining = returned.qty;
      let deductions = (bill.stockDeductions || []).filter((d) => d.drugId === item.drugId && d.qty > 0);
      if (deductions.length === 0) {
        const legacyBatch = clinicStore.batches.find((batch) => item.name.includes(batch.batchNumber));
        const legacyDrug = legacyBatch
          ? clinicStore.drugs.find((drug) => drug.id === legacyBatch.drugId)
          : undefined;
        if (legacyBatch) deductions = [{ drugId: legacyBatch.drugId, drugName: legacyDrug?.name || item.name, batchId: legacyBatch.id, batchNumber: legacyBatch.batchNumber, qty: Number(item.qty || 0) }];
      }
      for (const deduction of deductions) {
        if (remaining <= 0) break;
        const allocationKey = `${item.drugId}:${deduction.batchId || deduction.batchNumber}`;
        const alreadyAllocatedToBatch = allocatedThisRefund.get(allocationKey) || 0;
        const available = Math.max(0, deduction.qty - alreadyAllocatedToBatch);
        const quantity = Math.min(available, remaining);
        if (quantity <= 0) continue;
        const batch = clinicStore.batches.find((b) => b.id === deduction.batchId || b.batchNumber === deduction.batchNumber);
        if (!batch) return res.status(409).json({ error: `Original batch ${deduction.batchNumber} was not found.` });
        addedStock.push({ batch, qty: quantity });
        restored.push({ drugName: item.name, batchNumber: deduction.batchNumber, qty: quantity });
        remaining -= quantity;
        allocatedThisRefund.set(allocationKey, alreadyAllocatedToBatch + quantity);
      }
      if (remaining > 0) return res.status(409).json({ error: `Unable to restore the original batch allocation for ${item.name}.` });
    }
    for (const change of addedStock) {
      change.batch.quantity += change.qty;
      if (change.batch.status === 'depleted') change.batch.status = 'active';
    }
    for (const returned of refund.items) {
      const item = bill.items[returned.itemIndex];
      item.returnedQty = (item.returnedQty || 0) + returned.qty;
    }
  }

  const timestamp = new Date().toISOString();
  refund.status = 'completed';
  refund.approvedByUserId = userId;
  refund.approvedByName = userName;
  refund.approvedAt = timestamp;
  bill.returnedAt = timestamp;
  bill.returnedAmount = (bill.returnedAmount || 0) + refund.amount;
  const remainingRefundable = Math.max(0, (bill.amountPaid ?? bill.total) - (bill.returnedAmount || 0));
  bill.status = remainingRefundable <= 0.004 ? 'refunded' : 'partially_refunded';

  clinicStore.rebuildLedgers();
  clinicStore.addAuditLog(role, userName, 'REFUND_APPROVED', `Invoice: ${bill.invoiceNo}`,
    `Refund ${refund.refundNo} for ₹${refund.amount.toFixed(2)} approved. Method: ${refund.method}. Created by ${refund.createdByName}; approved by authenticated user ${userName} (${userId}, ${role}). Reason: "${refund.reason}". Items: ${refund.items.map((i) => `${bill.items[i.itemIndex]?.name || i.itemIndex} x${i.qty}`).join(', ') || 'amount refund'}. Restored stock: ${restored.map((r) => `${r.drugName} ${r.batchNumber} x${r.qty}`).join(', ') || 'none'}.`,
    bill.patientMrn, null, { invoiceNo: bill.invoiceNo, refundId: refund.id, refundAmount: refund.amount, refundMethod: refund.method, reason: refund.reason, refundedItems: refund.items, restoredStock: restored });
  clinicStore.broadcastUpdate('REFUND_APPROVED', { bill });
  res.json({ success: true, bill, refund, restoredStock: restored });
};

const createRefundRequest = (req: Request, res: Response) => {
  const { role, userName, userId } = getUserContext(req);
  const billId = req.body.billId || req.params.id;
  const bill = clinicStore.bills.find((b) => b.id === billId);
  if (!bill || !['paid', 'partially_paid', 'partially_refunded'].includes(bill.status)) return res.status(404).json({ error: 'Paid invoice not found.' });
  if (!String(req.body.reason || '').trim()) return res.status(400).json({ error: 'Refund reason is required.' });
  const idempotencyKey = typeof req.body.idempotencyKey === 'string' ? req.body.idempotencyKey.trim() : '';
  if (idempotencyKey && bill.refunds?.some((r) => r.idempotencyKey === idempotencyKey)) return res.status(409).json({ error: 'A refund with this idempotency key has already been requested.' });

  const paid = bill.amountPaid ?? bill.total;
  const alreadyRefunded = bill.returnedAmount || 0;
  const refundable = Math.max(0, paid - alreadyRefunded);
  const method = ['cash', 'upi', 'card'].includes(req.body.refundMethod) ? req.body.refundMethod : bill.paymentMethod;
  let requestedItems = Array.isArray(req.body.items) ? req.body.items : [];
  if (bill.type === 'pharmacy' && requestedItems.length === 0 && req.body.fullRefund === true) {
    requestedItems = bill.items.map((item, itemIndex) => ({ itemIndex, qty: Math.max(0, Number(item.qty || 0) - Number(item.returnedQty || 0)) })).filter((item) => item.qty > 0);
  }
  const refunds = new Map<number, number>();
  let itemAmount = 0;
  if (requestedItems.length) {
    for (const requested of requestedItems) {
      const itemIndex = Number(requested.itemIndex);
      const qty = Number(requested.qty);
      const item = bill.items[itemIndex];
      if (!item || !Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid refund item or quantity.' });
      const current = refunds.get(itemIndex) || 0;
      if ((item.returnedQty || 0) + current + qty > item.qty) return res.status(400).json({ error: `Cannot refund more than purchased quantity for ${item.name}.` });
      refunds.set(itemIndex, current + qty);
      itemAmount += qty * Number(item.unitPrice || 0);
    }
  }

  let amount = requestedItems.length ? itemAmount : Number(req.body.amount);
  if (!requestedItems.length && (!Number.isFinite(amount) || amount <= 0)) return res.status(400).json({ error: 'A positive refund amount or refund items are required.' });
  if (amount <= 0 || amount > refundable + 0.004) return res.status(400).json({ error: `Refund amount exceeds refundable balance of ₹${refundable.toFixed(2)}.` });
  const full = Math.abs(amount - paid) <= 0.004 || req.body.fullRefund === true;
  const timestamp = new Date().toISOString();
  const refundId = `refund-${Date.now()}-${bill.id}`;
  const refund: any = {
    id: refundId, refundNo: `RFD-${bill.invoiceNo}-${(bill.refunds?.length || 0) + 1}`,
    type: full ? 'full' : 'partial', items: [...refunds.entries()].map(([itemIndex, qty]) => ({ itemIndex, qty, amount: qty * Number(bill.items[itemIndex].unitPrice || 0) })),
    amount, reason: String(req.body.reason).trim(), method, status: 'pending', idempotencyKey: idempotencyKey || undefined,
    createdByUserId: userId, createdByName: userName, createdAt: timestamp,
  };
  bill.refunds = [...(bill.refunds || []), refund];
  clinicStore.addAuditLog(role, userName, 'REFUND_REQUESTED', `Invoice: ${bill.invoiceNo}`, `Requested ${refund.type} refund ${refund.refundNo} of ₹${amount.toFixed(2)}. Method: ${method}. Reason: "${refund.reason}".`, bill.patientMrn, null, { invoiceNo: bill.invoiceNo, refundId, refundAmount: amount, refundMethod: method, reason: refund.reason });
  clinicStore.broadcastUpdate('REFUND_REQUESTED', { bill, refund });
  res.status(202).json({ success: true, bill, refund, requiresApproval: true });
};

app.post('/api/bills/:id/refund', createRefundRequest);
app.post('/api/refunds/:billId/:id/approve', approveRefund);
app.post('/api/bills/:billId/refunds/:id/approve', approveRefund);

// ----------------------------------------------------
// 8. DRUG CATALOGUE: STOCK-IN & WRITE-OFF
// ----------------------------------------------------
app.post('/api/pharmacy/stock-in', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { drugId, batchNumber, expiryDate, quantity, purchasePrice, supplier, dateReceived } = req.body;

  if (!drugId || !batchNumber || !expiryDate || !quantity) {
    return res.status(400).json({ error: 'Drug, batch number, expiry date, and quantity are required.' });
  }

  // STAGE 6 EXPIRY VALIDATION:
  // Reject expiry in past or within 30 days of today with clear message
  const exp = new Date(expiryDate).getTime();
  const curr = new Date(CURRENT_DATE).getTime();
  const diffDays = (exp - curr) / (1000 * 60 * 60 * 24);

  if (diffDays <= 0) {
    return res.status(400).json({
      error: `INVALID EXPIRY DATE: ${expiryDate} is already in the past! New stock must be unexpired.`,
    });
  }

  if (diffDays < 30) {
    return res.status(400).json({
      error: `ONE-MONTH RULE VIOLATION: Expiry date ${expiryDate} is within 30 days (${Math.round(diffDays)} days remaining). Clinic policy requires incoming stock to have at least 1 month remaining shelf life.`,
    });
  }

  const drug = clinicStore.drugs.find((d) => d.id === drugId);

  const newBatch: DrugBatch = {
    id: `b-${Date.now()}`,
    drugId,
    batchNumber: batchNumber.trim().toUpperCase(),
    expiryDate,
    quantity: Number(quantity),
    purchasePrice: Number(purchasePrice) || 0,
    supplier: supplier || 'Standard Distributor',
    dateReceived: dateReceived || CURRENT_DATE,
  };

  clinicStore.batches.unshift(newBatch);

  clinicStore.addAuditLog(
    role,
    userName,
    'STOCK_IN',
    `Drug: ${drug?.name} (Batch ${newBatch.batchNumber})`,
    `Stock-in received: ${newBatch.quantity} units of ${drug?.name} under Batch ${newBatch.batchNumber} (Exp: ${newBatch.expiryDate}) from ${newBatch.supplier}. Purchase Rate: ₹${newBatch.purchasePrice}.`,
    undefined,
    null,
    newBatch
  );

  clinicStore.broadcastUpdate('STOCK_IN', { batch: newBatch });
  res.status(201).json(newBatch);
});

app.post('/api/pharmacy/write-off', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { batchId, reason } = req.body;

  const batch = clinicStore.batches.find((b) => b.id === batchId);
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'Write-off reason is required.' });
  }

  const drug = clinicStore.drugs.find((d) => d.id === batch.drugId);
  const writeOffQty = batch.quantity;
  const writeOffValue = writeOffQty * (batch.purchasePrice || 0);

  batch.isWrittenOff = true;
  batch.writeOffReason = reason.trim();
  batch.writeOffDate = new Date().toISOString();
  batch.writeOffQuantity = writeOffQty;
  batch.writeOffValue = writeOffValue;
  batch.quantity = 0; // zero out remaining active units

  clinicStore.addAuditLog(
    role,
    userName,
    'WRITE_OFF_EXPIRED_STOCK',
    `Batch: ${batch.batchNumber} (${drug?.name})`,
    `Stock write-off executed: ${writeOffQty} units of ${drug?.name} (Batch ${batch.batchNumber}, Expired: ${batch.expiryDate}). Loss Value: ₹${writeOffValue}. Reason: "${reason.trim()}".`,
    undefined,
    { quantity: writeOffQty },
    { quantity: 0, isWrittenOff: true, reason }
  );

  clinicStore.broadcastUpdate('STOCK_WRITTEN_OFF', { batchId });
  res.json({ success: true, batch });
});

// ----------------------------------------------------
// 9. CLINICAL TEMPLATES (PER-DOCTOR CRUD)
// ----------------------------------------------------
app.post('/api/templates', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { doctorId, name, chiefComplaint, history, examination, diagnosis, plan, suggestedMeds, suggestedProcedures } = req.body;

  if (!doctorId || !name || !diagnosis) {
    return res.status(400).json({ error: 'Doctor, template name, and diagnosis are required.' });
  }

  const newTemplate: ClinicalTemplate = {
    id: `tpl-${Date.now()}`,
    doctorId,
    name: name.trim(),
    chiefComplaint: chiefComplaint || '',
    history: history || '',
    examination: examination || '',
    diagnosis: diagnosis.trim(),
    plan: plan || '',
    suggestedMeds: suggestedMeds || [],
    suggestedProcedures: suggestedProcedures || [],
  };

  clinicStore.templates.push(newTemplate);

  clinicStore.addAuditLog(
    role,
    userName,
    'CREATE_TEMPLATE',
    `Template: ${newTemplate.name}`,
    `Doctor created clinical template "${newTemplate.name}" for diagnosis: ${newTemplate.diagnosis}.`,
    undefined,
    null,
    newTemplate
  );

  clinicStore.broadcastUpdate('TEMPLATE_CREATED', { template: newTemplate });
  res.status(201).json(newTemplate);
});

app.put('/api/templates/:id', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { id } = req.params;

  const tpl = clinicStore.templates.find((t) => t.id === id);
  if (!tpl) return res.status(404).json({ error: 'Template not found.' });

  const oldValues = { ...tpl };
  Object.assign(tpl, req.body);

  clinicStore.addAuditLog(
    role,
    userName,
    'UPDATE_TEMPLATE',
    `Template: ${tpl.name}`,
    `Updated clinical template "${tpl.name}".`,
    undefined,
    oldValues,
    tpl
  );

  clinicStore.broadcastUpdate('TEMPLATE_UPDATED', { template: tpl });
  res.json(tpl);
});

app.delete('/api/templates/:id', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { id } = req.params;

  const idx = clinicStore.templates.findIndex((t) => t.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Template not found.' });

  const deleted = clinicStore.templates.splice(idx, 1)[0];

  clinicStore.addAuditLog(
    role,
    userName,
    'DELETE_TEMPLATE',
    `Template: ${deleted.name}`,
    `Deleted clinical template "${deleted.name}". Past consultations saved from this template remain unchanged.`,
    undefined,
    deleted,
    null
  );

  clinicStore.broadcastUpdate('TEMPLATE_DELETED', { templateId: id });
  res.json({ success: true, deleted });
});

// ----------------------------------------------------
// 10. CASHIER SHIFTS & CLOSING
// ----------------------------------------------------
app.post('/api/shifts/open', (req: Request, res: Response) => {
  const { role, userName, userId } = getUserContext(req);
  const { department, shiftType, cashierName, openingCash } = req.body;
  if (!['receptionist', 'pharmacist', 'accounts', 'admin'].includes(role)) return res.status(403).json({ error: 'Only counter staff or Accounts can open a shift.' });
  if (!['reception', 'pharmacy'].includes(department)) return res.status(400).json({ error: 'Invalid shift department.' });
  if (Number(openingCash) < 0) return res.status(400).json({ error: 'Opening cash cannot be negative.' });
  const existingOpenShift = clinicStore.shifts.find((shift) => shift.department === department && shift.status === 'open');
  if (existingOpenShift) return res.status(409).json({ error: `${department === 'pharmacy' ? 'Pharmacy' : 'Reception'} already has an open shift. Close it before opening another.` });

  const newShift: ShiftRecord = {
    id: `shift-${department}-${Date.now()}`,
    department,
    shiftType,
    cashierName: cashierName || userName,
    status: 'open',
    openedAt: new Date().toISOString(),
    openingCash: Number(openingCash) || 0,
    openedByUserId: userId,
  };

  clinicStore.shifts.unshift(newShift);

  clinicStore.addAuditLog(
    role,
    userName,
    'OPEN_SHIFT',
    `Shift: ${department.toUpperCase()} - ${shiftType}`,
    `${newShift.cashierName} opened ${shiftType} register in ${department} with ₹${newShift.openingCash} opening float.`,
    undefined,
    null,
    newShift
  );

  clinicStore.broadcastUpdate('SHIFT_OPENED', { shift: newShift });
  res.status(201).json(newShift);
});

app.post('/api/shifts/:id/close', (req: Request, res: Response) => {
  const { role, userName, userId } = getUserContext(req);
  const { id } = req.params;
  const { actualCashCounted, handedOverTo, handoverNotes } = req.body;

  const shift = clinicStore.shifts.find((s) => s.id === id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });
  if (shift.status !== 'open') return res.status(409).json({ error: 'Shift is already closed.' });
  if (!['accounts', 'admin'].includes(role)) return res.status(403).json({ error: 'Only Accounts or Admin can close and tally a shift.' });
  if (!String(handedOverTo || '').trim()) return res.status(400).json({ error: 'Handover recipient is required.' });
  const actual = Number(actualCashCounted);
  if (!Number.isFinite(actual) || actual < 0) return res.status(400).json({ error: 'Enter a valid physical cash count.' });

  const timestamp = new Date().toISOString();

  const openedAtMs = new Date(shift.openedAt).getTime();
  const closingAtMs = new Date(timestamp).getTime();
  const isInShiftWindow = (dateValue?: string) => {
    if (!dateValue) return false;
    const time = new Date(dateValue).getTime();
    return time >= openedAtMs && time <= closingAtMs;
  };
  const shiftBills = clinicStore.bills.filter((b) => {
    const isDept = shift.department === 'pharmacy' ? b.type === 'pharmacy' : b.type !== 'pharmacy';
    return isDept && b.shift === shift.shiftType && isInShiftWindow(b.timestamp) && ['paid', 'partially_paid', 'partially_refunded', 'refunded'].includes(b.status);
  });

  const shiftVoids = clinicStore.bills.filter((b) => {
    const isDept = shift.department === 'pharmacy' ? b.type === 'pharmacy' : b.type !== 'pharmacy';
    return isDept && b.shift === shift.shiftType && isInShiftWindow(b.voidTimestamp || b.timestamp) && ['voided', 'cancelled'].includes(b.status);
  });

  const calculatedCash = shiftBills
    .filter((b) => b.paymentMethod === 'cash')
    .reduce((sum, b) => sum + b.total, 0);

  const calculatedUpi = shiftBills
    .filter((b) => b.paymentMethod === 'upi')
    .reduce((sum, b) => sum + b.total, 0);

  const calculatedCard = shiftBills
    .filter((b) => b.paymentMethod === 'card')
    .reduce((sum, b) => sum + b.total, 0);

  const cashRefunds = shiftBills.reduce((sum, bill) => sum + (bill.refunds || []).filter((refund) => refund.status === 'completed' && refund.method === 'cash' && isInShiftWindow(refund.approvedAt)).reduce((refundSum, refund) => refundSum + refund.amount, 0), 0);
  const expectedInDrawer = Math.max(0, shift.openingCash + calculatedCash - cashRefunds);
  const difference = actual - expectedInDrawer;

  shift.status = 'closed';
  shift.closedAt = timestamp;
  shift.closingActualCash = actual;
  shift.calculatedCash = calculatedCash;
  shift.calculatedUpi = calculatedUpi;
  shift.calculatedCard = calculatedCard;
  shift.totalBillsCount = shiftBills.length;
  shift.refundsCount = shiftVoids.length;
  shift.refundsTotal = shiftVoids.reduce((sum, b) => sum + b.total, 0) + cashRefunds;
  shift.difference = difference;
  shift.handedOverTo = String(handedOverTo).trim();
  shift.handoverNotes = String(handoverNotes || '').trim() || undefined;
  shift.handedOverAt = timestamp;
  shift.closedByUserId = userId;

  clinicStore.addAuditLog(
    role,
    userName,
    'CLOSE_SHIFT',
    `Shift: ${shift.department.toUpperCase()} - ${shift.shiftType}`,
    `Closed shift. Expected cash: ₹${expectedInDrawer} (Opening: ₹${shift.openingCash} + Cash sales: ₹${calculatedCash}). Actual physical count: ₹${actual}. Discrepancy: ₹${difference >= 0 ? '+' : ''}${difference}.`,
    undefined,
    { status: 'open' },
    shift
  );

  clinicStore.broadcastUpdate('SHIFT_CLOSED', { shift });
  res.json(shift);
});

// ----------------------------------------------------
// 11. INVOICE VOID WITH MANDATORY ACCOUNTS APPROVAL
// ----------------------------------------------------
const cancelInvoice = (req: Request, res: Response) => {
  const { role, userName, userId } = getUserContext(req);
  const { id } = req.params;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const bill = clinicStore.bills.find((b) => b.id === id);

  if (!bill) return res.status(404).json({ error: 'Bill not found.' });
  if (['voided', 'cancelled'].includes(bill.status)) {
    return res.status(400).json({ error: 'Invoice has already been cancelled or voided.' });
  }
  if (!reason) return res.status(400).json({ error: 'A reason for cancellation is required.' });
  if (role === 'receptionist') {
    if (bill.cancellationRequest?.status === 'pending') {
      return res.status(409).json({ error: 'Cancellation request is already pending Accounts approval.' });
    }
    bill.cancellationRequest = {
      status: 'pending',
      reason,
      requestedByUserId: userId,
      requestedByName: userName,
      requestedAt: new Date().toISOString(),
    };
    bill.voidReason = reason;
    clinicStore.addAuditLog(role, userName, 'CANCEL_REQUESTED', `Invoice: ${bill.invoiceNo}`, `Cancellation requested for invoice ${bill.invoiceNo}. Reason: "${reason}".`, bill.patientMrn, null, { invoiceNo: bill.invoiceNo, reason });
    clinicStore.broadcastUpdate('CANCEL_REQUESTED', { bill });
    return res.status(202).json({ success: true, bill, requiresApproval: true });
  }

  if (!['accounts', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Cancellation requires an authenticated Accounts or Admin approver.' });
  }

  const creatorId = bill.cashierUserId || bill.cashierName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const sameCreator = creatorId === userId || (!bill.cashierUserId && bill.cashierName.trim().toLowerCase() === userName.toLowerCase());
  if (sameCreator) {
    return res.status(403).json({ error: 'Segregation of duties violation: the invoice creator cannot approve cancellation.' });
  }

  const timestamp = new Date().toISOString();
  const amendmentId = `amendment-${Date.now()}-${bill.id}`;
  bill.status = 'voided';
  bill.voidReason = reason;
  bill.voidApprovedBy = userName;
  bill.voidTimestamp = timestamp;
  bill.amendments = [...(bill.amendments || []), {
    id: amendmentId,
    type: 'void',
    reason,
    amount: bill.total,
    originalInvoiceId: bill.id,
    originalInvoiceNo: bill.invoiceNo,
    createdByUserId: creatorId,
    createdByName: bill.cashierName,
    approvedByUserId: userId,
    approvedByName: userName,
    timestamp,
  }];

  clinicStore.addAuditLog(
    role,
    userName,
    'VOID_BILL',
    `Invoice: ${bill.invoiceNo}`,
    `Invoice ${bill.invoiceNo} (₹${bill.total}, ${bill.type}) VOIDED. Creator: ${bill.cashierName}. Approved by authenticated user ${userName} (${userId}, ${role}). Reason: "${reason}". Original invoice and financial values preserved. Amendment: ${amendmentId}.`,
    bill.patientMrn,
    { status: 'paid' },
    { status: 'voided', reason, approvedByUserId: userId, approvedByName: userName, amendmentId, timestamp }
  );

  clinicStore.broadcastUpdate('BILL_VOIDED', { billId: id, bill });
  res.json({ success: true, bill });
};

app.post('/api/bills/:id/void', cancelInvoice);
// Legacy-compatible cancellation endpoint, using the same standardized workflow.
app.post('/api/bills/:id/cancel', cancelInvoice);

// ----------------------------------------------------
// 12. ADMIN CLINIC SETTINGS & DEMO RESET
// ----------------------------------------------------
app.put('/api/settings', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const oldSettings = { ...clinicStore.settings };
  clinicStore.settings = { ...clinicStore.settings, ...req.body };

  clinicStore.addAuditLog(
    role,
    userName,
    'UPDATE_SETTINGS',
    'Clinic Settings',
    `Updated clinic settings (Name: ${clinicStore.settings.clinicName}, Reg: ${clinicStore.settings.regNumber}).`,
    undefined,
    oldSettings,
    clinicStore.settings
  );

  clinicStore.broadcastUpdate('SETTINGS_UPDATED', { settings: clinicStore.settings });
  res.json(clinicStore.settings);
});

app.post('/api/staff', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { name, email, phone, role: staffRole, modules, active, shift } = req.body;
  if (!String(name || '').trim() || !String(email || '').trim()) return res.status(400).json({ error: 'Name and email are required.' });
  if (clinicStore.staffAccounts.some((staff) => staff.email.toLowerCase() === String(email).trim().toLowerCase())) return res.status(400).json({ error: 'A staff account with this email already exists.' });
  const now = new Date().toISOString();
  const account = { id: `staff-${Date.now()}`, name: String(name).trim(), email: String(email).trim().toLowerCase(), phone: String(phone || '').trim(), role: staffRole || 'receptionist', modules: Array.isArray(modules) ? modules : [staffRole || 'receptionist'], active: active !== false, shift: shift || 'Shift A', createdAt: now, updatedAt: now };
  clinicStore.staffAccounts.unshift(account);
  clinicStore.addAuditLog(role, userName, 'CREATE_STAFF_ACCOUNT', `Staff: ${account.name}`, `Created staff account with role ${account.role}.`, undefined, null, account);
  if (account.role === 'doctor') {
    const doctorId = account.id.startsWith('staff-doc-') ? account.id.replace('staff-', '') as typeof clinicStore.doctors[number]['id'] : undefined;
    const doctor = doctorId ? clinicStore.doctors.find((item) => item.id === doctorId) : undefined;
    if (doctor) doctor.name = account.name;
  }
  clinicStore.broadcastUpdate('STAFF_ACCOUNT_CREATED', { staffId: account.id });
  res.status(201).json({ ...account, state: clinicStore.getFullState() });
});

app.put('/api/staff/:id', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const account = clinicStore.staffAccounts.find((staff) => staff.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Staff account not found.' });
  const before = { ...account };
  account.name = String(req.body.name || account.name).trim();
  account.email = String(req.body.email || account.email).trim().toLowerCase();
  account.phone = String(req.body.phone ?? account.phone).trim();
  account.role = req.body.role || account.role;
  account.modules = Array.isArray(req.body.modules) ? req.body.modules : account.modules;
  account.active = req.body.active !== false;
  account.shift = req.body.shift || account.shift;
  account.updatedAt = new Date().toISOString();
  clinicStore.addAuditLog(role, userName, 'UPDATE_STAFF_ACCOUNT', `Staff: ${account.name}`, `Updated staff account and role permissions.`, undefined, before, account);
  if (account.role === 'doctor') {
    const doctorId = account.id.startsWith('staff-doc-') ? account.id.replace('staff-', '') as typeof clinicStore.doctors[number]['id'] : undefined;
    const doctor = doctorId ? clinicStore.doctors.find((item) => item.id === doctorId) : undefined;
    if (doctor) {
      doctor.name = account.name;
      clinicStore.rooms.forEach((room) => { if (room.occupiedByDoctorId === doctor.id) room.occupiedByDoctorName = doctor.name; });
    }
  }
  clinicStore.broadcastUpdate('STAFF_ACCOUNT_UPDATED', { staffId: account.id });
  res.json({ ...account, state: clinicStore.getFullState() });
});

app.delete('/api/staff/:id', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const account = clinicStore.staffAccounts.find((staff) => staff.id === req.params.id);
  if (!account) return res.status(404).json({ error: 'Staff account not found.' });
  if (account.role === 'admin') return res.status(400).json({ error: 'At least one administrator account must remain active.' });
  account.active = false;
  account.updatedAt = new Date().toISOString();
  clinicStore.addAuditLog(role, userName, 'DEACTIVATE_STAFF_ACCOUNT', `Staff: ${account.name}`, 'Deactivated staff account; access remains disabled and the audit record is preserved.');
  clinicStore.broadcastUpdate('STAFF_ACCOUNT_DEACTIVATED', { staffId: account.id });
  res.json({ ...account, state: clinicStore.getFullState() });
});

app.put('/api/doctors/:id/schedule', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const doctor = clinicStore.doctors.find((item) => item.id === req.params.id);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found.' });
  const before = { ...doctor };
  const nextSchedule = {
    shift: req.body.shift || doctor.shift,
    startTime: String(req.body.startTime || doctor.startTime || '08:00'),
    endTime: String(req.body.endTime || doctor.endTime || '14:00'),
    workingDays: Array.isArray(req.body.workingDays) ? req.body.workingDays : doctor.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    roomId: req.body.roomId || undefined,
  };
  const validDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!validTime(nextSchedule.startTime) || !validTime(nextSchedule.endTime) || nextSchedule.startTime >= nextSchedule.endTime) {
    return res.status(400).json({ error: 'Enter valid schedule hours. End time must be later than start time.' });
  }
  if (!Array.isArray(nextSchedule.workingDays) || nextSchedule.workingDays.some((day: string) => !validDays.includes(day))) {
    return res.status(400).json({ error: 'Select valid working days.' });
  }
  const room = nextSchedule.roomId ? clinicStore.rooms.find((item) => item.id === nextSchedule.roomId) : undefined;
  if (nextSchedule.roomId && !room) return res.status(400).json({ error: 'Invalid consultation room.' });
  if (room) {
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const overlap = clinicStore.doctors.find((other) => {
      if (other.id === doctor.id || other.roomId !== room.id) return false;
      const otherDays = other.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const sharesDay = nextSchedule.workingDays.some((day: string) => otherDays.includes(day));
      if (!sharesDay) return false;
      return toMinutes(nextSchedule.startTime) < toMinutes(other.endTime || '14:00') && toMinutes(other.startTime || '08:00') < toMinutes(nextSchedule.endTime);
    });
    if (overlap) return res.status(400).json({ error: `${room.name} conflicts with ${overlap.name}'s schedule (${overlap.startTime}-${overlap.endTime}) on a shared working day. Use a different room or time.` });
  }
  Object.assign(doctor, nextSchedule);
  clinicStore.addAuditLog(role, userName, 'UPDATE_DOCTOR_SCHEDULE', `Doctor: ${doctor.name}`, `Updated schedule, shift, hours, working days, and room assignment.`, undefined, before, doctor);
  clinicStore.broadcastUpdate('DOCTOR_SCHEDULE_UPDATED', { doctorId: doctor.id });
  res.json({ ...doctor, state: clinicStore.getFullState() });
});

app.post('/api/admin/reset', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  clinicStore.resetDemoData(userName, role);
  res.json({ success: true, message: 'Demo data reset successfully. Audit log preserved.' });
});

// ----------------------------------------------------
// 13. VITE MIDDLEWARE / STATIC ASSETS
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[PJ Medical Clinic] Outpatient Management Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start clinic server:', err);
});
