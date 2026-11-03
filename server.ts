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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Helper to extract role and user from request headers
function getUserContext(req: Request) {
  const role = (req.headers['x-clinic-role'] as string) || 'receptionist';
  const userName = (req.headers['x-clinic-user'] as string) || 'Staff User';
  return { role, userName };
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

// ----------------------------------------------------
// 3. TOKENS & CONSULTATION FEE (RECEPTION)
// ----------------------------------------------------
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
  const invoiceNo = `REC-${new Date().getFullYear()}-${String(clinicStore.bills.length + 1).padStart(4, '0')}`;

  // Find active reception shift
  const activeShift = clinicStore.shifts.find(
    (s) => s.department === 'reception' && s.status === 'open'
  ) || clinicStore.shifts.find((s) => s.department === 'reception') || clinicStore.shifts[0] || { shiftType: 'Shift A' as ShiftType };

  const consultationBill: Bill = {
    id: `bill-${Date.now()}`,
    invoiceNo,
    type: 'consultation',
    visitId: `vis-${Date.now()}`,
    patientId: patient.id,
    patientName: patient.name,
    patientMrn: patient.mrn,
    items: [
      {
        name: `${doctor.name} - Consultation Fee (Token ${tokenNumber})`,
        qty: 1,
        unitPrice: doctor.consultationFee,
        total: doctor.consultationFee,
      },
    ],
    subtotal: doctor.consultationFee,
    tax: 0,
    total: doctor.consultationFee,
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
    fee: doctor.consultationFee,
    paymentMethod: paymentMethod || 'cash',
    upiRef: upiRef || undefined,
    cashierName: userName,
    shift: activeShift.shiftType,
    timestamp,
    status: 'waiting_doctor',
    consultationReceiptNo: invoiceNo,
    stageHistory: [
      {
        stage: 'registered_token_paid',
        timestamp,
        actorName: userName,
        actorRole: 'Receptionist',
        notes: `Consultation fee ₹${doctor.consultationFee} received via ${(paymentMethod || 'cash').toUpperCase()}`,
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

  clinicStore.bills.unshift(consultationBill);
  clinicStore.visits.unshift(newVisit);

  clinicStore.addAuditLog(
    role,
    userName,
    'CREATE_TOKEN_PAYMENT',
    `Token: ${tokenNumber}`,
    `Consultation fee ₹${doctor.consultationFee} collected via ${(paymentMethod || 'cash').toUpperCase()}${upiRef ? ` (Ref: ${upiRef})` : ''}. Issued token ${tokenNumber} for ${patient.name} (${patient.mrn}) with ${doctor.name}. Invoice: ${invoiceNo}`,
    patient.mrn,
    null,
    { token: tokenNumber, invoiceNo, fee: doctor.consultationFee }
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
  const docRoom = clinicStore.rooms.find((r) => r.occupiedByDoctorId === doctorId);
  // Find a free room
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

  const hasUnbilledProcedures = visit.procedureOrders.some((p) => !p.billed);
  const hasUnbilledLabs = (visit.labOrders || []).some((lab) => !lab.billed);
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
      allergies: [], registeredAt: new Date().toISOString(),
    };
    clinicStore.patients.unshift(patient);
    clinicStore.addAuditLog(role, userName, 'REGISTER_WALK_IN_LAB_PATIENT', `Patient: ${patient.name} (${patient.mrn})`, 'Walk-in patient registered for laboratory billing without consultation.', patient.mrn, null, patient);
  }

  const tests = labTestIds.map((id: string) => clinicStore.labTests.find((test) => test.id === id)).filter(Boolean) as typeof clinicStore.labTests;
  if (tests.length !== labTestIds.length) return res.status(400).json({ error: 'One or more selected laboratory tests are invalid.' });
  const timestamp = new Date().toISOString();
  const invoiceNo = `LAB-${new Date().getFullYear()}-${String(clinicStore.bills.length + 1).padStart(4, '0')}`;
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
    id: `bill-${Date.now()}`, invoiceNo, type: 'lab', visitId: labVisit.id, patientId: patient.id,
    patientName: patient.name, patientMrn: patient.mrn,
    items: labOrders.map((item) => ({ name: item.name, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
    subtotal, tax: 0, total: subtotal, paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined,
    cashierName: userName, shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid',
  };
  clinicStore.visits.unshift(labVisit);
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
  const { visitId, paymentMethod, upiRef } = req.body;
  const visit = clinicStore.visits.find((v) => v.id === visitId);
  const patient = clinicStore.patients.find((p) => p.id === visit?.patientId);
  if (!visit || !patient) return res.status(400).json({ error: 'Visit or patient not found.' });

  visit.labOrders = visit.labOrders || [];
  const unbilledProcedures = visit.procedureOrders.filter((p) => p.status === 'UNBILLED' || (!p.billed && p.status !== 'GIVEN'));
  const unbilledLabs = visit.labOrders.filter((lab) => lab.status === 'UNBILLED' || (!lab.billed && lab.status !== 'REPORTED'));
  if (!unbilledProcedures.length && !unbilledLabs.length) return res.status(400).json({ error: 'No unbilled procedure or laboratory items on this visit.' });

  const timestamp = new Date().toISOString();
  const invoiceNo = `REC-${new Date().getFullYear()}-${String(clinicStore.bills.length + 1).padStart(4, '0')}`;
  const billingItems = [
    ...unbilledProcedures.map((item) => ({ name: `[Procedure] ${item.name}`, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
    ...unbilledLabs.map((item) => ({ name: `[Lab] ${item.name}`, qty: item.qty, unitPrice: item.unitPrice, total: item.totalPrice })),
  ];
  const subtotal = billingItems.reduce((sum, item) => sum + item.total, 0);
  const activeShift = clinicStore.shifts.find((s) => s.department === 'reception' && s.status === 'open') || clinicStore.shifts[0];

  const combinedBill: Bill = {
    id: `bill-${Date.now()}`, invoiceNo, type: 'procedure', visitId: visit.id, patientId: patient.id,
    patientName: patient.name, patientMrn: patient.mrn, items: billingItems, subtotal, tax: 0, total: subtotal,
    paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined, cashierName: userName,
    shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid'
  };

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
  clinicStore.bills.unshift(combinedBill);
  clinicStore.addAuditLog(role, userName, 'BILL_PROCEDURES_AND_LABS', `Invoice: ${invoiceNo}`, `Combined procedure/lab bill ₹${subtotal} paid via ${(paymentMethod || 'cash').toUpperCase()} for token ${visit.tokenNumber} (${patient.name}).`, patient.mrn, null, { invoiceNo, total: subtotal });
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

  const billedItem = procBill.items.find((i) => i.name === proc.name);
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
  const invoiceNo = `PHM-${new Date().getFullYear()}-${String(
    clinicStore.bills.filter((b) => b.type === 'pharmacy').length + 1
  ).padStart(4, '0')}`;

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

  let patient = patientId ? clinicStore.patients.find((p) => p.id === patientId) : undefined;
  if (!patient) {
    if (!phone?.trim()) return res.status(400).json({ error: 'Outside customer mobile number is required.' });
    patient = {
      id: `pat-retail-${Date.now()}`,
      mrn: `PJ-${String(clinicStore.patients.length + 1).padStart(6, '0')}`,
      name: name?.trim() || 'Walk-in Customer', age: Number(age) || 0, sex: sex || 'Male',
      phone: phone.trim().startsWith('+91') ? phone.trim() : `+91 ${phone.trim()}`,
      allergies: [], registeredAt: new Date().toISOString(),
    };
    clinicStore.patients.unshift(patient);
  }

  const timestamp = new Date().toISOString();
  const today = timestamp.slice(0, 10);
  const billItems: Bill['items'] = [];
  const stockDeductions: { drugName: string; batchNumber: string; qty: number }[] = [];

  for (const requested of items) {
    const qty = Number(requested.qty);
    const drug = clinicStore.drugs.find((d) => d.id === requested.drugId);
    if (!drug || !Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'Invalid medicine or quantity.' });
    const batches = clinicStore.batches
      .filter((b) => b.drugId === drug.id && !b.isWrittenOff && b.quantity > 0 && b.expiryDate >= today)
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    const available = batches.reduce((sum, b) => sum + b.quantity, 0);
    if (available < qty) return res.status(400).json({ error: `Insufficient stock for ${drug.name}. Available: ${available}.` });

    let remaining = qty;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const taken = Math.min(batch.quantity, remaining);
      batch.quantity -= taken;
      remaining -= taken;
      stockDeductions.push({ drugName: drug.name, batchNumber: batch.batchNumber, qty: taken });
    }
    const dosage = String(requested.dosage || '').trim();
    const days = Math.max(1, Number(requested.days) || 1);
    if (!/^\d+-\d+-\d+$/.test(dosage)) return res.status(400).json({ error: `Dosage for ${drug.name} must be in 0-0-0 format.` });
    const total = qty * Number(drug.unitPrice || 0);
    billItems.push({ name: `${drug.name} ${drug.strength}`.trim(), qty, unitPrice: Number(drug.unitPrice || 0), total, dose: dosage, duration: `${days} day${days === 1 ? '' : 's'}` });
  }

  const subtotal = billItems.reduce((sum, item) => sum + item.total, 0);
  const invoiceNo = `RPM-${new Date().getFullYear()}-${String(clinicStore.bills.filter((b) => b.type === 'pharmacy').length + 1).padStart(4, '0')}`;
  const activeShift = clinicStore.shifts.find((s) => s.department === 'pharmacy' && s.status === 'open') || clinicStore.shifts.find((s) => s.department === 'pharmacy') || clinicStore.shifts[0];
  const bill: Bill = {
    id: `bill-${Date.now()}`, invoiceNo, type: 'pharmacy', visitId: `retail-vis-${Date.now()}`,
    patientId: patient.id, patientName: patient.name, patientMrn: patient.mrn,
    items: billItems, subtotal, tax: 0, total: subtotal,
    paymentMethod: paymentMethod || 'cash', upiRef: upiRef || undefined,
    cashierName: userName, shift: activeShift?.shiftType || 'Shift A', timestamp, status: 'paid',
  };
  clinicStore.bills.unshift(bill);
  clinicStore.addAuditLog(role, userName, 'BILL_RETAIL_PHARMACY', `Invoice: ${invoiceNo}`, `Retail pharmacy invoice ${invoiceNo} for ${patient.name} (${patient.mrn}) total ₹${subtotal}. FEFO deductions: ${stockDeductions.map((d) => `${d.drugName} ${d.batchNumber} x${d.qty}`).join(', ')}`, patient.mrn, null, { invoiceNo, total: subtotal, stockDeductions });
  clinicStore.broadcastUpdate('RETAIL_PHARMACY_BILLED', { bill });
  res.status(201).json({ bill });
});

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
  const { role, userName } = getUserContext(req);
  const { department, shiftType, cashierName, openingCash } = req.body;

  const newShift: ShiftRecord = {
    id: `shift-${department}-${Date.now()}`,
    department,
    shiftType,
    cashierName: cashierName || userName,
    status: 'open',
    openedAt: new Date().toISOString(),
    openingCash: Number(openingCash) || 0,
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
  const { role, userName } = getUserContext(req);
  const { id } = req.params;
  const { actualCashCounted } = req.body;

  const shift = clinicStore.shifts.find((s) => s.id === id);
  if (!shift) return res.status(404).json({ error: 'Shift not found.' });

  const timestamp = new Date().toISOString();

  // Tally paid and voided bills for this shift
  const shiftBills = clinicStore.bills.filter((b) => {
    const isDept = shift.department === 'pharmacy' ? b.type === 'pharmacy' : b.type !== 'pharmacy';
    return isDept && b.shift === shift.shiftType && b.status === 'paid';
  });

  const shiftVoids = clinicStore.bills.filter((b) => {
    const isDept = shift.department === 'pharmacy' ? b.type === 'pharmacy' : b.type !== 'pharmacy';
    return isDept && b.shift === shift.shiftType && b.status === 'voided';
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

  const actual = Number(actualCashCounted) || 0;
  const expectedInDrawer = shift.openingCash + calculatedCash;
  const difference = actual - expectedInDrawer;

  shift.status = 'closed';
  shift.closedAt = timestamp;
  shift.closingActualCash = actual;
  shift.calculatedCash = calculatedCash;
  shift.calculatedUpi = calculatedUpi;
  shift.calculatedCard = calculatedCard;
  shift.totalBillsCount = shiftBills.length;
  shift.refundsCount = shiftVoids.length;
  shift.refundsTotal = shiftVoids.reduce((sum, b) => sum + b.total, 0);
  shift.difference = difference;

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
app.post('/api/bills/:id/void', (req: Request, res: Response) => {
  const { role, userName } = getUserContext(req);
  const { id } = req.params;
  const { reason, approvedBy, approverRole } = req.body;

  const bill = clinicStore.bills.find((b) => b.id === id);
  if (!bill) return res.status(404).json({ error: 'Bill not found.' });

  if (bill.status === 'voided') {
    return res.status(400).json({ error: 'Bill is already marked as voided.' });
  }

  // STAGE 7 SAFETY RULE 3:
  // Approver must be Accounts role only!
  if (approverRole !== 'accounts' && role !== 'accounts') {
    return res.status(403).json({
      error: 'SECURITY VIOLATION: Voiding an invoice requires authorization from an Accounts role user.',
    });
  }

  // The person who created the bill CANNOT approve its void!
  const finalApproverName = approvedBy || userName;
  if (finalApproverName.trim().toLowerCase() === bill.cashierName.trim().toLowerCase()) {
    return res.status(403).json({
      error: `SEGREGATION OF DUTIES VIOLATION: Cashier "${bill.cashierName}" created this bill and CANNOT self-approve its void! Another manager/accounts user must approve.`,
    });
  }

  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: 'A stated reason for voiding this invoice is mandatory.' });
  }

  const timestamp = new Date().toISOString();
  bill.status = 'voided';
  bill.voidReason = reason.trim();
  bill.voidApprovedBy = finalApproverName;
  bill.voidTimestamp = timestamp;

  clinicStore.addAuditLog(
    role,
    userName,
    'VOID_BILL',
    `Invoice: ${bill.invoiceNo}`,
    `Invoice ${bill.invoiceNo} (₹${bill.total}, ${bill.type}) VOIDED. Creator: ${bill.cashierName}. Approved by: ${finalApproverName} (Accounts). Reason: "${reason.trim()}". Original bill kept in audit.`,
    bill.patientMrn,
    { status: 'paid' },
    { status: 'voided', reason: bill.voidReason, approvedBy: finalApproverName, timestamp }
  );

  clinicStore.broadcastUpdate('BILL_VOIDED', { billId: id, bill });
  res.json({ success: true, bill });
});

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
