import React, { useState, useEffect } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  TokenVisit,
  CaseSheet,
  PrescribedMedicine,
  PrescribedProcedure,
  PrescribedLabTest,
  ClinicalTemplate
} from '../types';
import {
  Stethoscope,
  AlertTriangle,
  FileCheck2,
  PhoneCall,
  Plus,
  Trash2,
  Sparkles,
  HeartPulse,
  Syringe,
  Pill,
  CheckCircle2,
  Activity,
  FlaskConical,
  History,
  ShieldAlert,
  Printer,
  Edit2,
  HelpCircle,
  ExternalLink,
  Search
} from 'lucide-react';
import { PatientJourneyBar } from '../components/PatientJourneyBar';
import { PrescriptionPrintModal } from '../components/PrescriptionPrintModal';
import { VisitHistoryModal } from '../components/VisitHistoryModal';
import { LabInvestigationPrintModal } from '../components/LabInvestigationPrintModal';

export const DoctorScreen: React.FC = () => {
  const {
    doctors,
    rooms,
    drugs,
    procedures,
    labTests,
    patients,
    visits,
    templates,
    bills,
    settings,
    userName,
    currentDoctorId,
    setCurrentDoctorId,
    callNextToken,
    saveCaseSheet,
    updatePrescriptions,
    updateProcedureOrders,
    updateLabOrders,
    finishConsultation,
    updatePatientAllergies,
    updatePatientPastHistory,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    showToast,
    showConfirm,
  } = useClinic();

  const currentDoctor = doctors.find((d) => d.id === currentDoctorId) || doctors[0];
  const doctorRoom = rooms.find((r) => r.occupiedByDoctorId === currentDoctorId);

  useEffect(() => {
    const assignedDoctor = doctors.find((doctor) => {
      const normalizedDoctorName = doctor.name.replace(/\s*\(placeholder\)$/i, '').trim().toLowerCase();
      const normalizedUserName = userName.replace(/\s*\(placeholder\)$/i, '').trim().toLowerCase();
      return normalizedDoctorName === normalizedUserName || normalizedUserName.includes(normalizedDoctorName);
    });

    if (assignedDoctor && assignedDoctor.id !== currentDoctorId) {
      setCurrentDoctorId(assignedDoctor.id);
    }
  }, [doctors, userName, currentDoctorId, setCurrentDoctorId]);

  // Active visit with current doctor
  const activeVisit = visits.find(
    (v) => v.doctorId === currentDoctorId && v.status === 'with_doctor'
  );

  // Doctor's waiting queue
  const myQueue = visits
    .filter((v) => v.doctorId === currentDoctorId && v.status === 'waiting_doctor')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const activePatient = patients.find((p) => p.id === activeVisit?.patientId);

  // STAGE 3: Filter templates strictly belonging to this doctor!
  const myTemplates = templates.filter((t) => t.doctorId === currentDoctorId);
  const seenVisits = visits
    .filter((visit) =>
      visit.doctorId === currentDoctorId &&
      visit.status !== 'waiting_doctor' &&
      Boolean(visit.caseSheet?.diagnosis || visit.caseSheet?.chiefComplaint)
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Queue view and case-sheet view are separate screens.
  const [isCaseSheetOpen, setIsCaseSheetOpen] = useState(false);
  const [selectedSeenVisitId, setSelectedSeenVisitId] = useState<string | null>(null);
  const [isSearchCaseSheetView, setIsSearchCaseSheetView] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const selectedSeenVisit = visits.find((visit) => visit.id === selectedSeenVisitId);
  const selectedSeenPatient = patients.find((patient) => patient.id === selectedSeenVisit?.patientId);
  const consultationVisit = selectedSeenVisit || activeVisit;
  const consultationPatient = selectedSeenPatient || activePatient;
  const searchedCaseSheetVisits = consultationPatient
    ? visits
        .filter((visit) => visit.patientId === consultationPatient.id && Boolean(visit.caseSheet))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    : [];

  const normalizedPatientSearch = patientSearch.trim().toLowerCase();
  const normalizedPhoneSearch = patientSearch.replace(/\D/g, '');
  const patientSearchResults = normalizedPatientSearch
    ? patients.filter((patient) => {
        const matchesMrn = patient.mrn.toLowerCase().includes(normalizedPatientSearch);
        const matchesPhone = normalizedPhoneSearch.length >= 3 && patient.phone.replace(/\D/g, '').includes(normalizedPhoneSearch);
        return matchesMrn || matchesPhone;
      }).slice(0, 8)
    : [];

  const openLatestCaseSheet = (patientId: string) => {
    const latestVisit = visits
      .filter((visit) => visit.patientId === patientId && visit.caseSheet)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (!latestVisit) {
      showToast('warning', 'This patient has no saved case sheet yet.', 'No Case Sheet');
      return;
    }
    setSelectedSeenVisitId(latestVisit.id);
    setIsSearchCaseSheetView(true);
    setIsCaseSheetOpen(true);
  };

  // Local CaseSheet state
  const [caseSheet, setCaseSheet] = useState<CaseSheet>({
    chiefComplaint: '',
    history: '',
    pastHistory: '',
    vitals: { bp: '', pulse: '', temp: '', spo2: '', weight: '', respiratoryRate: '' },
    examination: '',
    diagnosis: '',
    plan: '',
  });

  const [prescriptions, setPrescriptions] = useState<PrescribedMedicine[]>([]);
  const [procedureOrders, setProcedureOrders] = useState<PrescribedProcedure[]>([]);
  const [labOrders, setLabOrders] = useState<PrescribedLabTest[]>([]);
  const [selectedLabTestId, setSelectedLabTestId] = useState<string>('');
  const [labNotes, setLabNotes] = useState<string>('');

  // Allergy edit state
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');

  // Drug Selector State
  const [selectedDrugId, setSelectedDrugId] = useState<string>('');
  const [medDose, setMedDose] = useState('1 tab');
  const [medFrequency, setMedFrequency] = useState('TDS (after food)');
  const [medDuration, setMedDuration] = useState('3 days');
  const [medInstructions, setMedInstructions] = useState('Take after food');
  const [medQty, setMedQty] = useState<number>(10);

  // Outside Medicine Modal State
  const [isAddingOutsideMed, setIsAddingOutsideMed] = useState(false);
  const [outsideMedName, setOutsideMedName] = useState('');
  const [outsideMedStrength, setOutsideMedStrength] = useState('');
  const [outsideMedForm, setOutsideMedForm] = useState('Tablet');
  const [outsideMedDose, setOutsideMedDose] = useState('1 tab');
  const [outsideMedFreq, setOutsideMedFreq] = useState('TDS (after food)');
  const [outsideMedDuration, setOutsideMedDuration] = useState('5 days');
  const [outsideMedQty, setOutsideMedQty] = useState<number>(10);
  const [outsideMedInstructions, setOutsideMedInstructions] = useState('Purchase from outside retail pharmacy');

  // Dose Editing State (Stage B requirement)
  const [editingMedIndex, setEditingMedIndex] = useState<number | null>(null);
  const [editingMedDose, setEditingMedDose] = useState('');
  const [editingMedFreq, setEditingMedFreq] = useState('');
  const [editingMedDuration, setEditingMedDuration] = useState('');
  const [editingMedQty, setEditingMedQty] = useState<number>(10);

  // Allergy Warning Override Modal State
  const [allergyAlertOpen, setAllergyAlertOpen] = useState(false);
  const [pendingAllergicDrug, setPendingAllergicDrug] = useState<any>(null);
  const [allergyOverrideReason, setAllergyOverrideReason] = useState('');

  // Per-Doctor Template Form Modal State (Add / Edit)
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    chiefComplaint: '',
    history: '',
    examination: '',
    diagnosis: '',
    plan: '',
  });

  // Procedure Add State
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>('');
  const [procQty, setProcQty] = useState<number>(1);
  const [procNotes, setProcNotes] = useState<string>('');

  // Modal Triggers
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [showVisitHistoryModal, setShowVisitHistoryModal] = useState(false);

  // Track if past history was auto-loaded from patient record (for visual cue)
  const [pastHistoryWasAutoLoaded, setPastHistoryWasAutoLoaded] = useState(false);

  // Lab Print Modal State
  type LabPrintState = {
    visitId: string;
    patientName: string;
    patientMrn: string;
    tokenNumber: string;
    labOrders: PrescribedLabTest[];
  } | null;
  const [labPrintOpen, setLabPrintOpen] = useState<LabPrintState>(null);

  // Synchronize state when the active or selected seen visit changes
  // Seed pastHistory from patient's persistent record if available
  useEffect(() => {
    if (consultationVisit) {
      const savedCaseSheet = consultationVisit.caseSheet || {
        chiefComplaint: '',
        history: '',
        pastHistory: '',
        vitals: { bp: '', pulse: '', temp: '', spo2: '', weight: '', respiratoryRate: '' },
        examination: '',
        diagnosis: '',
        plan: '',
      };
      // Use saved pastHistory if present, otherwise seed from patient's record
      const patientPastHistory = consultationPatient?.pastHistory || '';
      const existingPastHistory = savedCaseSheet.pastHistory || '';
      const pastHistoryValue = existingPastHistory || patientPastHistory;
      setCaseSheet({
        ...savedCaseSheet,
        pastHistory: pastHistoryValue,
      });
      // Set flag if we auto-loaded past history (no existing visit pastHistory)
      setPastHistoryWasAutoLoaded(!existingPastHistory && !!patientPastHistory);
      setPrescriptions(consultationVisit.prescriptions || []);
      setProcedureOrders(consultationVisit.procedureOrders || []);
      setLabOrders(consultationVisit.labOrders || []);
    } else {
      const patientPastHistory = consultationPatient?.pastHistory || '';
      setCaseSheet({
        chiefComplaint: '',
        history: '',
        pastHistory: patientPastHistory,
        vitals: { bp: '', pulse: '', temp: '', spo2: '', weight: '', respiratoryRate: '' },
        examination: '',
        diagnosis: '',
        plan: '',
      });
      setPastHistoryWasAutoLoaded(!!patientPastHistory);
      setPrescriptions([]);
      setProcedureOrders([]);
      setLabOrders([]);
    }
  }, [consultationVisit?.id, consultationPatient?.pastHistory]);

  const handleCallNext = async () => {
    const called = await callNextToken(currentDoctorId);
    if (called) setIsCaseSheetOpen(true);
  };

  const handleSaveAllergies = async () => {
    if (!consultationPatient) return;
    const list = allergyInput
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const ok = await updatePatientAllergies(consultationPatient.id, list);
    if (ok) {
      setIsEditingAllergies(false);
    }
  };

  const handleApplyTemplate = (tpl: ClinicalTemplate) => {
    const hasExistingNotes =
      caseSheet.chiefComplaint.trim() ||
      caseSheet.examination.trim() ||
      caseSheet.diagnosis.trim() ||
      caseSheet.plan.trim();

    if (hasExistingNotes) {
      showConfirm({
        title: 'Apply Clinical Template?',
        message: `Applying template "${tpl.name}" will update your notes and merge suggested items. Would you like to proceed?`,
        confirmLabel: 'Apply Template',
        onConfirm: () => {
          doApplyTemplate(tpl);
        },
      });
    } else {
      doApplyTemplate(tpl);
    }
  };

  const doApplyTemplate = (tpl: ClinicalTemplate) => {
    setCaseSheet((prev) => ({
      ...prev,
      chiefComplaint: prev.chiefComplaint ? `${prev.chiefComplaint} | ${tpl.chiefComplaint}` : tpl.chiefComplaint,
      history: prev.history ? `${prev.history} | ${tpl.history}` : tpl.history,
      examination: prev.examination ? `${prev.examination} | ${tpl.examination}` : tpl.examination,
      diagnosis: tpl.diagnosis,
      plan: prev.plan ? `${prev.plan}\n${tpl.plan}` : tpl.plan,
    }));

    if (tpl.suggestedMeds) {
      const newMeds: PrescribedMedicine[] = tpl.suggestedMeds.map((m) => ({
        drugName: m.drugName || '',
        strength: m.strength || '',
        form: m.form || 'Tablet',
        dose: m.dose || '1 tab',
        frequency: m.frequency || 'TDS',
        duration: m.duration || '3 days',
        instructions: m.instructions || 'After food',
        isOutsideMedicine: false,
        unitPrice: m.unitPrice || 30,
        qtyToDispense: m.qtyToDispense || 10,
        qtyDispensed: 0,
        dispensed: false,
      }));
      const updated = [...prescriptions, ...newMeds];
      setPrescriptions(updated);
      if (consultationVisit) updatePrescriptions(consultationVisit.id, updated);
    }

    if (tpl.suggestedProcedures) {
      const newProcs: PrescribedProcedure[] = tpl.suggestedProcedures.map((p) => {
        const cat = procedures.find((pr) => pr.id === p.procedureId);
        return {
          procedureId: p.procedureId,
          name: cat?.name || 'Procedure',
          unitPrice: cat?.price || 150,
          qty: p.qty,
          totalPrice: (cat?.price || 150) * p.qty,
          notes: p.notes,
          status: 'UNBILLED',
          billed: false,
          nurseGiven: false,
        };
      });
      const updated = [...procedureOrders, ...newProcs];
      setProcedureOrders(updated);
      if (consultationVisit) updateProcedureOrders(consultationVisit.id, updated);
    }

    showToast('success', `Applied template: ${tpl.name}`);
  };

  const handleOpenTemplateModal = (tpl?: ClinicalTemplate) => {
    if (tpl) {
      setEditingTemplateId(tpl.id);
      setTemplateForm({
        name: tpl.name,
        chiefComplaint: tpl.chiefComplaint,
        history: tpl.history,
        examination: tpl.examination,
        diagnosis: tpl.diagnosis,
        plan: tpl.plan,
      });
    } else {
      setEditingTemplateId(null);
      setTemplateForm({
        name: '',
        chiefComplaint: '',
        history: '',
        examination: '',
        diagnosis: '',
        plan: '',
      });
    }
    setTemplateModalOpen(true);
  };

  const handleSaveTemplateForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.diagnosis.trim()) {
      showToast('warning', 'Template name and diagnosis are required.');
      return;
    }

    if (editingTemplateId) {
      await updateTemplate(editingTemplateId, templateForm);
    } else {
      await createTemplate({
        doctorId: currentDoctorId,
        ...templateForm,
      });
    }

    setTemplateModalOpen(false);
  };

  const handleDeleteTemplate = (tpl: ClinicalTemplate) => {
    showConfirm({
      title: 'Delete Template?',
      message: `Are you sure you want to delete template "${tpl.name}"? Past consultations created with this template will not be altered.`,
      isDestructive: true,
      confirmLabel: 'Delete Template',
      onConfirm: async () => {
        await deleteTemplate(tpl.id);
      },
    });
  };

  const handleAddInHouseDrug = () => {
    if (!selectedDrugId) return;
    const drug = drugs.find((d) => d.id === selectedDrugId);
    if (!drug) return;

    // Check stock
    const availableStock = drug.stockQty !== undefined ? drug.stockQty : 0;
    if (availableStock <= 0) {
      showToast('warning', `${drug.name} is OUT OF STOCK. Prescribe as an Outside Medicine.`, 'Out of Stock');
      return;
    }

    if (!drug.allergyClass) {
      showToast('warning', 'Allergy check not available for this drug - doctor to confirm', 'Allergy Check');
    }

    // Check patient allergy match
    if (consultationPatient && consultationPatient.allergies.length > 0) {
      const match = consultationPatient.allergies.find((al) => {
        const alLower = al.toLowerCase();
        const classMatch = drug.allergyClass && drug.allergyClass.toLowerCase().includes(alLower);
        const contraMatch = drug.contraindicatedAllergies?.some((c) => c.toLowerCase().includes(alLower) || alLower.includes(c.toLowerCase()));
        return classMatch || contraMatch;
      });

      if (match) {
        setPendingAllergicDrug({
          drug,
          matchingAllergy: match,
          dose: medDose,
          frequency: medFrequency,
          duration: medDuration,
          instructions: medInstructions,
          qty: medQty,
        });
        setAllergyAlertOpen(true);
        return;
      }
    }

    // Add drug directly
    const newMed: PrescribedMedicine = {
      drugId: drug.id,
      drugName: drug.name,
      strength: drug.strength,
      form: drug.form,
      dose: medDose,
      frequency: medFrequency,
      duration: medDuration,
      instructions: medInstructions,
      isOutsideMedicine: false,
      unitPrice: drug.unitPrice,
      qtyToDispense: medQty,
      qtyDispensed: 0,
      dispensed: false,
    };

    const updated = [...prescriptions, newMed];
    setPrescriptions(updated);
    if (consultationVisit) updatePrescriptions(consultationVisit.id, updated);
    setSelectedDrugId('');
    showToast('success', `Added ${drug.name} to prescription.`);
  };

  const handleConfirmAllergyOverride = () => {
    if (!allergyOverrideReason.trim()) {
      showToast('error', 'You MUST enter a clinical reason to override an allergy warning.', 'Reason Required');
      return;
    }

    const { drug, matchingAllergy, dose, frequency, duration, instructions, qty } = pendingAllergicDrug;

    const newMed: PrescribedMedicine = {
      drugId: drug.id,
      drugName: drug.name,
      strength: drug.strength,
      form: drug.form,
      dose,
      frequency,
      duration,
      instructions,
      isOutsideMedicine: false,
      unitPrice: drug.unitPrice,
      qtyToDispense: qty,
      qtyDispensed: 0,
      dispensed: false,
      allergyWarningIgnored: true,
      allergyWarningReason: `ALLERGY WARNING (${matchingAllergy}) OVERRIDDEN: ${allergyOverrideReason.trim()}`,
    };

    const updated = [...prescriptions, newMed];
    setPrescriptions(updated);
    if (consultationVisit) updatePrescriptions(consultationVisit.id, updated);

    setAllergyAlertOpen(false);
    setPendingAllergicDrug(null);
    setAllergyOverrideReason('');
    setSelectedDrugId('');
    showToast('warning', `Added ${drug.name} with documented clinical override reason.`);
  };

  const handleAddOutsideMedicine = async () => {
    if (!outsideMedName.trim() || !outsideMedStrength.trim()) {
      showToast('warning', 'Please enter outside medicine name and strength.');
      return;
    }

    const newMed: PrescribedMedicine = {
      drugName: outsideMedName.trim(),
      strength: outsideMedStrength.trim(),
      form: outsideMedForm || 'Tablet',
      dose: outsideMedDose.trim() || '1 tab',
      frequency: outsideMedFreq.trim() || 'TDS (after food)',
      duration: outsideMedDuration.trim() || '5 days',
      instructions: outsideMedInstructions.trim() || 'Purchase from outside retail pharmacy',
      isOutsideMedicine: true,
      unitPrice: 0,
      qtyToDispense: Number(outsideMedQty) || 10,
      qtyDispensed: 0,
      dispensed: false,
    };

    const updated = [...prescriptions, newMed];
    setPrescriptions(updated);
    if (consultationVisit) await updatePrescriptions(consultationVisit.id, updated);

    setIsAddingOutsideMed(false);
    setOutsideMedName('');
    setOutsideMedStrength('');
    setOutsideMedDose('1 tab');
    setOutsideMedQty(10);
    showToast('info', `Added outside medicine: ${newMed.drugName} (Purchase outside).`);
  };

  const handleStartEditMed = (idx: number, med: PrescribedMedicine) => {
    setEditingMedIndex(idx);
    setEditingMedDose(med.dose);
    setEditingMedFreq(med.frequency || 'TDS');
    setEditingMedDuration(med.duration || '3 days');
    setEditingMedQty(med.qtyToDispense || 10);
  };

  const handleCancelEditMed = () => {
    setEditingMedIndex(null);
  };

  const handleSaveMedEdit = async (idx: number) => {
    if (!editingMedDose.trim()) {
      showToast('warning', 'Dose cannot be empty.');
      return;
    }
    const updated = prescriptions.map((p, i) => {
      if (i !== idx) return p;
      return {
        ...p,
        dose: editingMedDose.trim(),
        frequency: editingMedFreq.trim() || p.frequency,
        duration: editingMedDuration.trim() || p.duration,
        qtyToDispense: Number(editingMedQty) || p.qtyToDispense || 10,
      };
    });
    setPrescriptions(updated);
    setEditingMedIndex(null);
    if (consultationVisit) {
      await updatePrescriptions(consultationVisit.id, updated);
      showToast('success', `Updated dose for ${updated[idx].drugName} to "${updated[idx].dose}". Pharmacy queue updated live.`, 'Dose Updated');
    }
  };

  const handleSaveAllPrescriptions = async () => {
    if (!consultationVisit) {
      showToast('warning', 'No active patient in consultation.');
      return;
    }
    const ok = await updatePrescriptions(consultationVisit.id, prescriptions);
    if (ok) {
      showToast('success', `Saved ${prescriptions.length} medicine(s) to server. Pharmacy queue updated live.`, 'Prescription Saved');
    }
  };

  const handleRemovePrescription = (idx: number) => {
    const updated = prescriptions.filter((_, i) => i !== idx);
    setPrescriptions(updated);
    if (consultationVisit) updatePrescriptions(consultationVisit.id, updated);
  };

  const handleAddLabTest = () => {
    if (!selectedLabTestId || !consultationVisit) return;
    const test = labTests.find((item) => item.id === selectedLabTestId);
    if (!test) return;
    const order: PrescribedLabTest = {
      labTestId: test.id,
      name: test.name,
      unitPrice: test.price,
      qty: 1,
      totalPrice: test.price,
      notes: labNotes.trim() || undefined,
      status: 'UNBILLED',
      billed: false,
      collected: false,
      reported: false,
    };
    if (labOrders.some((item) => item.labTestId === test.id)) {
      showToast('warning', 'This laboratory test is already ordered for this visit.');
      return;
    }
    const updated = [...labOrders, order];
    setLabOrders(updated);
    updateLabOrders(consultationVisit.id, updated);
    setSelectedLabTestId('');
    setLabNotes('');
  };

  const handleRemoveLabTest = (idx: number) => {
    const updated = labOrders.filter((_, i) => i !== idx);
    setLabOrders(updated);
    if (consultationVisit) updateLabOrders(consultationVisit.id, updated);
  };

  const handleAddProcedure = () => {
    if (!selectedProcedureId) return;
    const cat = procedures.find((p) => p.id === selectedProcedureId);
    if (!cat) return;

    const newProc: PrescribedProcedure = {
      procedureId: cat.id,
      name: cat.name,
      unitPrice: cat.price,
      qty: procQty,
      totalPrice: cat.price * procQty,
      notes: procNotes,
      status: 'UNBILLED',
      billed: false,
      nurseGiven: false,
    };

    const updated = [...procedureOrders, newProc];
    setProcedureOrders(updated);
    if (consultationVisit) updateProcedureOrders(consultationVisit.id, updated);

    setSelectedProcedureId('');
    setProcQty(1);
    setProcNotes('');
    showToast('success', `Added procedure order: ${newProc.name}.`);
  };

  const handleRemoveProcedure = (idx: number) => {
    const updated = procedureOrders.filter((_, i) => i !== idx);
    setProcedureOrders(updated);
    if (consultationVisit) updateProcedureOrders(consultationVisit.id, updated);
  };

  const handleSaveDraftCaseSheet = async () => {
    if (!consultationVisit) return;
    await saveCaseSheet(consultationVisit.id, caseSheet);
    // Sync past history to patient record
    if (consultationPatient) {
      await updatePatientPastHistory(consultationPatient.id, caseSheet.pastHistory);
    }
    setIsCaseSheetOpen(false);
    setSelectedSeenVisitId(null);
  };

  const handleCompleteConsultation = async () => {
    if (!consultationVisit) return;

    if (!caseSheet.diagnosis.trim()) {
      showConfirm({
        title: 'Diagnosis is Blank',
        message: 'You have not entered a diagnosis yet. Would you like to finish the consultation anyway?',
        confirmLabel: 'Finish Anyway',
        onConfirm: async () => {
          const saved = await Promise.all([
            saveCaseSheet(consultationVisit.id, caseSheet),
            updatePrescriptions(consultationVisit.id, prescriptions),
            updateProcedureOrders(consultationVisit.id, procedureOrders),
            updateLabOrders(consultationVisit.id, labOrders),
          ]);
          if (!saved.every(Boolean)) {
            showToast('error', 'Consultation was not finished because one or more clinical updates failed to save. Please retry.');
            return;
          }
          // Sync past history to patient record
          if (consultationPatient) {
            await updatePatientPastHistory(consultationPatient.id, caseSheet.pastHistory);
          }
          const finished = await finishConsultation(consultationVisit.id);
          if (finished) setIsCaseSheetOpen(false);
        },
      });
      return;
    }

    const saved = await Promise.all([
      saveCaseSheet(consultationVisit.id, caseSheet),
      updatePrescriptions(consultationVisit.id, prescriptions),
      updateProcedureOrders(consultationVisit.id, procedureOrders),
      updateLabOrders(consultationVisit.id, labOrders),
    ]);
    if (!saved.every(Boolean)) {
      showToast('error', 'Consultation was not finished because one or more clinical updates failed to save. Please retry.');
      return;
    }
    // Sync past history to patient record
    if (consultationPatient) {
      await updatePatientPastHistory(consultationPatient.id, caseSheet.pastHistory);
    }
    const finished = await finishConsultation(consultationVisit.id);
    if (finished) setIsCaseSheetOpen(false);
  };

  const handleCopyPreviousVisit = async (previousVisit: TokenVisit) => {
    if (!consultationVisit || !previousVisit.caseSheet) return;

    setCaseSheet(previousVisit.caseSheet);
    setPrescriptions(previousVisit.prescriptions || []);
    setProcedureOrders(previousVisit.procedureOrders || []);
    setLabOrders(previousVisit.labOrders || []);

    await saveCaseSheet(consultationVisit.id, previousVisit.caseSheet);
    await updatePrescriptions(consultationVisit.id, previousVisit.prescriptions || []);
    await updateProcedureOrders(consultationVisit.id, previousVisit.procedureOrders || []);
    await updateLabOrders(consultationVisit.id, previousVisit.labOrders || []);
    setShowVisitHistoryModal(false);
    showToast('success', `Copied ${previousVisit.tokenNumber} into the current consultation.`);
  };

  const handleOpenPrescriptionPrint = async () => {
    if (!consultationVisit) return;

    // STAGE C RULE: Print prescription reads the saved prescription at the moment of print.
    // It must include every medicine saved, including newly added drugs.
    if (prescriptions.length > 0) {
      await updatePrescriptions(consultationVisit.id, prescriptions);
    }
    if (caseSheet.diagnosis || caseSheet.chiefComplaint) {
      await saveCaseSheet(consultationVisit.id, caseSheet);
    }

    setShowPrescriptionModal(true);
  };

  if (!currentDoctor) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading doctor profile...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar: Doctor Selector & Room Assignment */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <Stethoscope className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                {currentDoctor.name}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 font-mono text-slate-700">
                Prefix: {currentDoctor.tokenPrefix}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {currentDoctor.specialty} · {currentDoctor.qualification} · Reg: {currentDoctor.registrationNumber}
            </p>
          </div>
        </div>

        {/* Doctor Switcher & Room Badge */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <span className="text-[11px] text-slate-500 block">Consultation Room</span>
            <span className="text-xs font-bold font-mono text-teal-800 bg-teal-50 px-2.5 py-1 rounded border border-teal-200 inline-block">
              {doctorRoom ? `${doctorRoom.name} (Active)` : 'Vacant (No Room)'}
            </span>
          </div>

        </div>
      </div>

      {/* Quick patient lookup by medical record number or mobile number. */}
      <div className="mb-4 max-w-xl relative">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-xs focus-within:ring-2 focus-within:ring-teal-500">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="search"
            value={patientSearch}
            onChange={(event) => setPatientSearch(event.target.value)}
            placeholder="Search patient by MRN or mobile number"
            className="w-full text-sm outline-none text-slate-800 placeholder:text-slate-400"
          />
        </div>
        {normalizedPatientSearch && (
          <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            {patientSearchResults.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">No matching patient found.</div>
            ) : patientSearchResults.map((patient) => (
              <button
                type="button"
                key={patient.id}
                onClick={() => {
                  openLatestCaseSheet(patient.id);
                  setPatientSearch('');
                }}
                className="w-full px-4 py-3 text-left hover:bg-teal-50 border-b last:border-b-0 border-slate-100 flex items-center justify-between gap-3 cursor-pointer"
              >
                <div>
                  <div className="text-sm font-bold text-slate-900">{patient.name}</div>
                  <div className="text-xs text-slate-500 font-mono">{patient.mrn} · {patient.phone}</div>
                </div>
                <span className="text-[10px] font-bold text-teal-700">OPEN CASE SHEET</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Waiting Queue is wider so assigned patients are easy to select. */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Doctor's Queue */}
        <div className={`${isCaseSheetOpen ? 'hidden' : 'lg:col-span-12'} bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4`}>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                My Queue ({myQueue.length} Waiting)
              </h3>
              <p className="text-xs text-slate-500">Assigned specifically to {currentDoctor.name}</p>
            </div>
          </div>

          {/* Call Next Button */}
          <button
            onClick={handleCallNext}
            disabled={myQueue.length === 0}
            className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-sm rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>Call Next Token</span>
          </button>

          {/* Queue List */}
          <div className="space-y-2 pt-1 max-h-[720px] overflow-y-auto pr-1">
            {myQueue.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 italic">
                No patients waiting in queue for {currentDoctor.name}.
              </div>
            ) : (
              myQueue.map((v, i) => {
                const pat = patients.find((p) => p.id === v.patientId);

                return (
                  <button
                    type="button"
                    key={v.id}
                    onClick={async () => {
                      const called = await callNextToken(currentDoctorId, v.id);
                      if (called) {
                        setIsSearchCaseSheetView(false);
                        setIsCaseSheetOpen(true);
                      }
                    }}
                    className="w-full p-3 rounded-lg border border-slate-200 bg-slate-50 hover:border-teal-400 hover:bg-teal-50 transition-all flex items-center justify-between text-left cursor-pointer"
                    title="Call this patient and open the case sheet"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono font-bold text-slate-400 w-4">
                        #{i + 1}
                      </span>
                      <div>
                        <div className="text-base font-black font-mono text-slate-900">
                          {v.tokenNumber}
                        </div>
                        <div className="text-xs font-semibold text-slate-700">
                          {pat?.name} ({pat?.age}y, {pat?.sex[0]})
                        </div>
                        {pat?.allergies && pat.allergies.length > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                            ⚠️ Allergies: {pat.allergies.join(', ')}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500 italic truncate max-w-[170px]">
                          {v.reason}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">
                      {new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          </div>

          {/* Patients already seen by this doctor */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
            <div className="pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase">Seen Patients ({seenVisits.length})</h3>
              <p className="text-xs text-slate-500">Consultations completed by {currentDoctor.name}</p>
            </div>
            <div className="space-y-2 max-h-[720px] overflow-y-auto pr-1">
              {seenVisits.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">No seen patients yet.</div>
              ) : seenVisits.map((visit) => {
                const patient = patients.find((item) => item.id === visit.patientId);
                return (
                  <button
                    type="button"
                    key={visit.id}
                    onClick={() => {
                      setSelectedSeenVisitId(visit.id);
                      setIsSearchCaseSheetView(false);
                      setIsCaseSheetOpen(true);
                    }}
                    className="w-full text-left p-3 rounded-lg border border-emerald-200 bg-white hover:border-teal-400 hover:bg-teal-50 flex items-center justify-between gap-3 cursor-pointer"
                    title="Open and edit seen patient's case sheet"
                  >
                    <div>
                      <div className="text-sm font-black font-mono text-slate-900">{visit.tokenNumber}</div>
                      <div className="text-xs font-semibold text-slate-700">{patient?.name} ({patient?.age}y, {patient?.sex[0]})</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">{visit.caseSheet?.diagnosis || visit.reason}</div>
                    </div>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">SEEN</span>
                  </button>
                );
              })}
            </div>
          </div>
          </div>
        </div>

        {/* Active Consultation Sheet */}
        <div className={`${isCaseSheetOpen ? 'lg:col-span-12' : 'hidden'} bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-6`}>
          {consultationVisit && consultationPatient ? (
            <>
              {/* Patient Banner */}
              <div className="p-4 bg-slate-900 text-white rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-teal-500/20 border border-teal-500/40 rounded-lg text-center">
                    <span className="text-[10px] uppercase font-bold text-teal-300 block">TOKEN</span>
                    <span className="text-2xl font-black font-mono text-white tracking-wider">
                      {consultationVisit.tokenNumber}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <span>{consultationPatient.name}</span>
                      <span className="text-xs font-mono font-normal text-slate-400">
                        ({consultationPatient.mrn})
                      </span>
                    </h3>
                    <p className="text-xs text-slate-300">
                      Age: {consultationPatient.age} yrs · Sex: {consultationPatient.sex} · Phone: {consultationPatient.phone}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCaseSheetOpen(false);
                      setSelectedSeenVisitId(null);
                      setIsSearchCaseSheetView(false);
                    }}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    Back to Queue
                  </button>
                  {!isSearchCaseSheetView && <button
                    type="button"
                    onClick={() => setShowVisitHistoryModal(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <History className="w-4 h-4 text-teal-400" />
                    <span>Past History</span>
                  </button>}
                  {!isSearchCaseSheetView && <button
                    type="button"
                    onClick={handleOpenPrescriptionPrint}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Prescription</span>
                  </button>}
                </div>
              </div>

              {isSearchCaseSheetView ? (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-5" aria-label="Read-only case sheet">
                  <div className="rounded-lg bg-white border border-slate-200 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Search result · Case sheet history</div>
                      <div className="text-sm font-semibold text-slate-800">View only — editing and printing are disabled</div>
                    </div>
                    <span className="text-xs font-bold text-slate-500 font-mono">{consultationVisit.tokenNumber}</span>
                  </div>
                  <div className="rounded-lg bg-white border border-slate-200 p-4">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
                      Past Consultations ({searchedCaseSheetVisits.length})
                    </div>
                    {searchedCaseSheetVisits.length === 0 ? (
                      <div className="text-xs text-slate-500 italic">No saved consultations found.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {searchedCaseSheetVisits.map((visit) => {
                          const isSelected = visit.id === consultationVisit.id;
                          const visitDate = new Date(visit.timestamp).toLocaleDateString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric'
                          });
                          return (
                            <button
                              type="button"
                              key={visit.id}
                              onClick={() => setSelectedSeenVisitId(visit.id)}
                              className={`px-3 py-2 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-teal-600 border-teal-600 text-white'
                                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-teal-400 hover:bg-teal-50'
                              }`}
                            >
                              {visitDate} · {visit.tokenNumber}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      ['Chief Complaint / H/O', caseSheet.chiefComplaint],
                      ['History / H/O', caseSheet.history],
                      ['Past Medical History', caseSheet.pastHistory],
                      ['Examination', caseSheet.examination],
                      ['Diagnosis', caseSheet.diagnosis],
                      ['Plan / Treatment Notes', caseSheet.plan],
                    ].map(([label, value]) => (
                      <div key={label} className={`${label.includes('Plan') || label.includes('History') || label.includes('Chief') ? 'md:col-span-2' : ''} rounded-lg border border-slate-200 bg-white p-4`}>
                        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{label}</div>
                        <div className="text-sm whitespace-pre-wrap text-slate-800 min-h-12">{value || '—'}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {Object.entries(caseSheet.vitals || {}).map(([label, value]) => {
                      const vitalLabels: Record<string, string> = {
                        bp: 'BP (mmHg)',
                        pulse: 'Pulse (bpm)',
                        temp: 'Temp (°F)',
                        spo2: 'SpO₂ (%)',
                        weight: 'Weight (kg)',
                        respiratoryRate: 'RR (/min)',
                      };
                      return (
                        <div key={label} className="rounded-lg border border-slate-200 bg-white p-3">
                          <div className="text-[10px] font-bold uppercase text-slate-500">{vitalLabels[label] || label}</div>
                          <div className="text-sm font-semibold text-slate-800 mt-1">{value || '—'}</div>
                        </div>
                      );
                    })}
                  </div>
                  {(prescriptions.length > 0 || procedureOrders.length > 0 || labOrders.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase text-slate-500 mb-2">Prescribed Medication</div>
                        {prescriptions.length === 0 ? <div className="text-xs text-slate-400 italic">No medication prescribed</div> : prescriptions.map((item, index) => {
                          const status = item.isOutsideMedicine
                            ? 'Outside medicine · not billed'
                            : item.dispensed
                              ? 'Dispensed · Billed'
                              : consultationVisit.pharmacyBillId
                                ? 'Billed · Pending dispensing'
                                : 'Unbilled';
                          return (
                            <div key={index} className="py-2 border-b last:border-0">
                              <div className="text-sm font-semibold text-slate-800">{item.drugName} {item.strength}</div>
                              <div className="text-xs text-slate-500">{item.dose} · {item.frequency} · {item.duration}</div>
                              <div className={`text-[10px] font-bold mt-1 ${status.includes('Unbilled') ? 'text-amber-700' : 'text-emerald-700'}`}>{status}</div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase text-slate-500 mb-2">Procedures</div>
                        {procedureOrders.length === 0 ? <div className="text-xs text-slate-400 italic">No procedures</div> : procedureOrders.map((item, index) => (
                          <div key={index} className="py-2 border-b last:border-0">
                            <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                            <div className="text-xs text-slate-500">Qty {item.qty}{item.notes ? ` · ${item.notes}` : ''}</div>
                            <div className={`text-[10px] font-bold mt-1 ${item.status === 'UNBILLED' ? 'text-amber-700' : item.status === 'GIVEN' ? 'text-emerald-700' : 'text-sky-700'}`}>{item.status === 'GIVEN' ? 'Given by nurse · Billed' : item.status}</div>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="text-xs font-bold uppercase text-slate-500 mb-2">Lab Investigations</div>
                        {labOrders.length === 0 ? <div className="text-xs text-slate-400 italic">No laboratory tests</div> : labOrders.map((item, index) => {
                          const status = item.reported ? 'Reported' : item.collected ? 'Sample collected' : item.status;
                          return (
                            <div key={index} className="py-2 border-b last:border-0">
                              <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                              {item.notes && <div className="text-xs text-slate-500">{item.notes}</div>}
                              <div className={`text-[10px] font-bold mt-1 ${item.status === 'UNBILLED' ? 'text-amber-700' : item.reported ? 'text-emerald-700' : 'text-sky-700'}`}>{status}{item.status === 'BILLED' || item.status === 'COLLECTED' || item.reported ? ' · Billed' : ''}</div>
                              {item.resultSummary && <div className="text-xs text-slate-600 mt-1">Result: {item.resultSummary}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <> 
              {/* Progress Bar */}
              <PatientJourneyBar visit={consultationVisit} />

              {/* ALLERGIES RED BANNER AT THE TOP */}
              <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-rose-800">
                      Recorded Patient Drug Allergies
                    </div>
                    {consultationPatient.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {consultationPatient.allergies.map((al, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-rose-600 text-white font-bold text-xs rounded-md shadow-2xs"
                          >
                            ⚠️ {al}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-rose-700 italic mt-0.5">
                        No known drug allergies recorded for this patient.
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAllergyInput(consultationPatient.allergies.join(', '));
                    setIsEditingAllergies(!isEditingAllergies);
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-800 bg-white border border-rose-300 rounded-lg hover:bg-rose-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isEditingAllergies ? 'Cancel Edit' : 'Edit Allergies'}
                </button>
              </div>

              {/* Allergies Inline Edit Drawer */}
              {isEditingAllergies && (
                <div className="p-3 bg-white border border-rose-200 rounded-lg flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Enter allergies separated by comma (e.g. Penicillins, Sulphonamides)"
                    value={allergyInput}
                    onChange={(e) => setAllergyInput(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:border-rose-500 focus:outline-hidden"
                  />
                  <button
                    onClick={handleSaveAllergies}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-md cursor-pointer"
                  >
                    Save Allergies
                  </button>
                </div>
              )}

              {/* STAGE 3: PER-DOCTOR CLINICAL TEMPLATES */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                    <span>My Clinical Templates ({currentDoctor.name})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleOpenTemplateModal()}
                    className="text-xs font-bold text-teal-700 hover:text-teal-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ New Template</span>
                  </button>
                </div>

                {myTemplates.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">
                    No clinical templates saved for {currentDoctor.name}. Click "+ New Template" to create one.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {myTemplates.map((tpl) => (
                      <div
                        key={tpl.id}
                        className="group flex items-center gap-1 bg-white border border-slate-200 rounded-lg pl-3 pr-1.5 py-1 text-xs shadow-2xs hover:border-teal-400 transition-all"
                      >
                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          className="font-medium text-slate-800 hover:text-teal-800 text-left cursor-pointer"
                          title="Click to apply template"
                        >
                          {tpl.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenTemplateModal(tpl)}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          title="Edit template"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(tpl)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          title="Delete template"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Vitals Form */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-teal-600" />
                  <span>Vital Signs</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">BP (mmHg)</span>
                    <input
                      type="text"
                      placeholder="120/80"
                      value={caseSheet.vitals.bp}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, bp: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Pulse (bpm)</span>
                    <input
                      type="text"
                      placeholder="76"
                      value={caseSheet.vitals.pulse}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, pulse: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Temp (°F)</span>
                    <input
                      type="text"
                      placeholder="98.6"
                      value={caseSheet.vitals.temp}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, temp: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">SpO₂ (%)</span>
                    <input
                      type="text"
                      placeholder="99"
                      value={caseSheet.vitals.spo2}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, spo2: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">Weight (kg)</span>
                    <input
                      type="text"
                      placeholder="68"
                      value={caseSheet.vitals.weight}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, weight: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-medium block">RR (per min)</span>
                    <input
                      type="text"
                      placeholder="16"
                      value={caseSheet.vitals.respiratoryRate}
                      onChange={(e) =>
                        setCaseSheet({
                          ...caseSheet,
                          vitals: { ...caseSheet.vitals, respiratoryRate: e.target.value },
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>

              {/* Case Sheet Narrative Sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                    Chief Complaint *
                  </label>
                  <textarea
                    rows={2}
                    value={caseSheet.chiefComplaint}
                    onChange={(e) => setCaseSheet({ ...caseSheet, chiefComplaint: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    placeholder="Presenting complaints, onset, duration..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                    History of Present Illness
                  </label>
                  <textarea
                    rows={2}
                    value={caseSheet.history}
                    onChange={(e) => setCaseSheet({ ...caseSheet, history: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    placeholder="Chronology, past illnesses, comorbidities..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase mb-1 flex items-center gap-1.5">
                    <span>Past Medical History {pastHistoryWasAutoLoaded && <span className="text-[10px] font-normal text-amber-600" title="Loaded from patient record">⇢</span>}</span>
                  </label>
                  <textarea
                    rows={2}
                    value={caseSheet.pastHistory}
                    onChange={(e) => setCaseSheet({ ...caseSheet, pastHistory: e.target.value })}
                    className={`w-full p-2.5 text-xs bg-slate-50 border ${pastHistoryWasAutoLoaded ? 'border-amber-400 bg-amber-50/50' : 'border-slate-200'} rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden`}
                    placeholder="Past surgeries, chronic illnesses, previous hospitalisations, family history..."
                  />
                  {pastHistoryWasAutoLoaded && (
                    <p className="text-[10px] text-amber-600 mt-0.5">Loaded from patient record – edit to update for future visits</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                    Physical Examination
                  </label>
                  <textarea
                    rows={2}
                    value={caseSheet.examination}
                    onChange={(e) => setCaseSheet({ ...caseSheet, examination: e.target.value })}
                    className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    placeholder="General appearance, systemic exam, chest, abdomen..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                    Diagnosis *
                  </label>
                  <input
                    type="text"
                    value={caseSheet.diagnosis}
                    onChange={(e) => setCaseSheet({ ...caseSheet, diagnosis: e.target.value })}
                    className="w-full p-2.5 text-xs font-bold text-slate-900 bg-teal-50/30 border border-teal-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                    placeholder="Clinical diagnosis (e.g. Acute Bronchitis, Type 2 Diabetes)"
                  />
                  <div className="mt-2">
                    <label className="block text-xs font-bold text-slate-800 uppercase mb-1">
                      Advice & Plan
                    </label>
                    <textarea
                      rows={2}
                      value={caseSheet.plan}
                      onChange={(e) => setCaseSheet({ ...caseSheet, plan: e.target.value })}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                      placeholder="Diet advice, warning signs, review in 3 days..."
                    />
                  </div>
                </div>
              </div>

              {/* PRESCRIPTIONS */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Pill className="w-5 h-5 text-teal-600" />
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      Prescription Medicines ({prescriptions.length})
                    </h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveAllPrescriptions}
                      disabled={prescriptions.length === 0}
                      className="px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 disabled:opacity-40 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="Saves all prescribed medicines to the server"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Save Prescription</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsAddingOutsideMed(true)}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer"
                    >
                      + Outside Medicine (External)
                    </button>
                  </div>
                </div>

                {/* Drug Catalogue Picker */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase">
                      Add From Clinic Drug Catalogue
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Stock is checked via FEFO batch allocation
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-5">
                      <select
                        value={selectedDrugId}
                        onChange={(e) => setSelectedDrugId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden font-medium"
                      >
                        <option value="">-- Choose drug from catalogue --</option>
                        {drugs.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.genericName}) - {d.strength} {(d.stockQty || 0) <= 0 ? '❌ OUT OF STOCK' : `[Stock: ${d.stockQty}]`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="Dose (1 tab)"
                        value={medDose}
                        onChange={(e) => setMedDose(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="Freq (TDS)"
                        value={medFrequency}
                        onChange={(e) => setMedFrequency(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="text"
                        placeholder="Duration (3 days)"
                        value={medDuration}
                        onChange={(e) => setMedDuration(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <button
                        type="button"
                        onClick={handleAddInHouseDrug}
                        disabled={!selectedDrugId}
                        className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Safety Notice: If selected drug has NO allergy class (Stage C preview) */}
                  {selectedDrugId && !drugs.find((d) => d.id === selectedDrugId)?.allergyClass && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-800 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        ⚠️ <strong>Allergy check not available for this drug - doctor to confirm</strong> with patient before prescribing.
                      </span>
                    </div>
                  )}

                  {/* Out of Stock notice */}
                  {selectedDrugId && (drugs.find((d) => d.id === selectedDrugId)?.stockQty || 0) <= 0 && (
                    <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-md text-xs text-amber-800 flex items-center justify-between">
                      <span>⚠️ This drug is currently <strong>OUT OF STOCK</strong> in the clinic pharmacy.</span>
                      <button
                        type="button"
                        onClick={() => {
                          const d = drugs.find((dr) => dr.id === selectedDrugId);
                          if (d) {
                            setOutsideMedName(d.name);
                            setOutsideMedStrength(d.strength);
                            setOutsideMedForm(d.form);
                            setIsAddingOutsideMed(true);
                          }
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-amber-600 rounded hover:bg-amber-700 cursor-pointer"
                      >
                        Prescribe as Outside Medicine
                      </button>
                    </div>
                  )}
                </div>

                {/* Outside Medicine Drawer */}
                {isAddingOutsideMed && (
                  <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-900 uppercase">
                        Prescribe Outside Medicine (Marked "Purchase outside" · Not Billed by Clinic)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsAddingOutsideMed(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Medicine Name *</label>
                        <input
                          type="text"
                          placeholder="Drug Name (e.g. Augmentin 625)"
                          value={outsideMedName}
                          onChange={(e) => setOutsideMedName(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Strength *</label>
                        <input
                          type="text"
                          placeholder="e.g. 625mg"
                          value={outsideMedStrength}
                          onChange={(e) => setOutsideMedStrength(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Dose *</label>
                        <input
                          type="text"
                          placeholder="e.g. 1 tab"
                          value={outsideMedDose}
                          onChange={(e) => setOutsideMedDose(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Quantity</label>
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty (10)"
                          value={outsideMedQty}
                          onChange={(e) => setOutsideMedQty(parseInt(e.target.value, 10) || 1)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded font-mono"
                        />
                      </div>
                      <div className="sm:col-span-1">
                        <label className="text-[10px] text-slate-500 font-bold block mb-0.5">Duration</label>
                        <input
                          type="text"
                          placeholder="e.g. 5 days"
                          value={outsideMedDuration}
                          onChange={(e) => setOutsideMedDuration(e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleAddOutsideMedicine}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg cursor-pointer shadow-xs transition-colors"
                      >
                        Add Outside Medicine
                      </button>
                    </div>
                  </div>
                )}

                {/* Prescriptions Table */}
                {prescriptions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 italic">
                    No medicines prescribed yet.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2">Medicine</th>
                          <th className="px-3 py-2">Form & Strength</th>
                          <th className="px-3 py-2">Dose / Freq</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2">Duration</th>
                          <th className="px-3 py-2">Source</th>
                          <th className="px-3 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {prescriptions.map((m, idx) => {
                          const isEditingThis = editingMedIndex === idx;

                          if (isEditingThis) {
                            return (
                              <tr key={idx} className="bg-teal-50/60">
                                <td className="px-3 py-2 font-bold text-slate-900">
                                  {m.drugName}
                                  <span className="block text-[10px] text-teal-700 font-normal">Editing details...</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600 font-mono">
                                  {m.form} · {m.strength}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editingMedDose}
                                      onChange={(e) => setEditingMedDose(e.target.value)}
                                      placeholder="Dose (e.g. 2 tabs)"
                                      className="w-24 px-2 py-1 text-xs bg-white border border-teal-500 rounded font-bold text-slate-900 focus:outline-hidden"
                                      autoFocus
                                    />
                                    <input
                                      type="text"
                                      value={editingMedFreq}
                                      onChange={(e) => setEditingMedFreq(e.target.value)}
                                      placeholder="Freq (TDS)"
                                      className="w-20 px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-hidden"
                                    />
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <input
                                    type="number"
                                    min="1"
                                    value={editingMedQty}
                                    onChange={(e) => setEditingMedQty(parseInt(e.target.value, 10) || 1)}
                                    className="w-14 px-1.5 py-1 text-xs bg-white border border-slate-300 rounded font-mono text-center focus:outline-hidden"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={editingMedDuration}
                                    onChange={(e) => setEditingMedDuration(e.target.value)}
                                    placeholder="Duration"
                                    className="w-20 px-2 py-1 text-xs bg-white border border-slate-300 rounded text-slate-700 focus:outline-hidden"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  {m.isOutsideMedicine ? (
                                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                      Purchase outside
                                    </span>
                                  ) : (
                                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                      Clinic Pharmacy
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveMedEdit(idx)}
                                      className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-bold transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                                      title="Save edited dose to server"
                                    >
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>Save</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleCancelEditMed}
                                      className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs transition-colors cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2.5 font-bold text-slate-900">
                                {m.drugName}
                                {m.allergyWarningIgnored && (
                                  <div className="text-[10px] text-rose-600 font-semibold mt-0.5">
                                    ⚠️ {m.allergyWarningReason}
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-slate-600 font-mono">
                                {m.form} · {m.strength}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700">
                                <span className="font-bold text-slate-900 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 font-mono">
                                  {m.dose}
                                </span>{' '}
                                <span className="text-slate-500 font-mono text-[11px]">
                                  ({m.frequency})
                                </span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-800">
                                {m.qtyToDispense || m.qtyDispensed || 10}
                              </td>
                              <td className="px-3 py-2.5 text-slate-700 font-mono">
                                {m.duration}
                              </td>
                              <td className="px-3 py-2.5">
                                {m.isOutsideMedicine ? (
                                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    Purchase outside
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                    Clinic Pharmacy
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEditMed(idx, m)}
                                    className="px-2 py-1 text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer border border-teal-200"
                                    title="Edit dose or quantity"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePrescription(idx)}
                                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                    title="Remove medicine"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* PROCEDURES & INJECTIONS */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center gap-2">
                  <Syringe className="w-5 h-5 text-teal-600" />
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 uppercase">
                      Procedures & Injections Orders ({procedureOrders.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Billed at reception; verified and checked by Nurse.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
                    <div className="md:col-span-6">
                      <select
                        value={selectedProcedureId}
                        onChange={(e) => setSelectedProcedureId(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-medium"
                      >
                        <option value="">-- Choose procedure/injection --</option>
                        {procedures.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{p.price}) - {p.category}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <input
                        type="number"
                        min="1"
                        max="10"
                        placeholder="Qty (1)"
                        value={procQty}
                        onChange={(e) => setProcQty(parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md font-mono"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <input
                        type="text"
                        placeholder="Instructions / site"
                        value={procNotes}
                        onChange={(e) => setProcNotes(e.target.value)}
                        className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md"
                      />
                    </div>

                    <div className="md:col-span-1">
                      <button
                        type="button"
                        onClick={handleAddProcedure}
                        disabled={!selectedProcedureId}
                        className="w-full py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white font-bold text-xs rounded-md shadow-xs transition-colors cursor-pointer"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                {procedureOrders.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                        <tr>
                          <th className="px-3 py-2">Item Description</th>
                          <th className="px-3 py-2 text-center">Qty</th>
                          <th className="px-3 py-2 text-right">Fee (₹)</th>
                          <th className="px-3 py-2">Instructions</th>
                          <th className="px-3 py-2 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {procedureOrders.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-3 py-2.5 font-bold text-slate-900">{p.name}</td>
                            <td className="px-3 py-2.5 text-center font-mono">{p.qty}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold">
                              ₹{p.totalPrice}
                            </td>
                            <td className="px-3 py-2.5 text-slate-600">{p.notes || '-'}</td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveProcedure(idx)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* LABORATORY ORDERS */}
              <div className="pt-4 border-t border-slate-200 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 uppercase">Laboratory Orders ({labOrders.length})</h4>
                      <p className="text-[11px] text-slate-500">Select tests; they will be combined with procedures on one reception bill.</p>
                    </div>
                  </div>
                  {labOrders.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const patient = patients.find(p => p.id === consultationVisit?.patientId);
                        setLabPrintOpen({
                          visitId: consultationVisit?.id || '',
                          patientName: patient?.name || '',
                          patientMrn: patient?.mrn || '',
                          tokenNumber: consultationVisit?.tokenNumber || '',
                          labOrders
                        });
                      }}
                      className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Print lab investigation list"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Lab</span>
                    </button>
                  )}
                </div>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-2.5">
                  <div className="md:col-span-8">
                    <select value={selectedLabTestId} onChange={(e) => setSelectedLabTestId(e.target.value)} className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-md font-medium">
                      <option value="">-- Choose laboratory test --</option>
                      {labTests.map((test) => <option key={test.id} value={test.id}>{test.name} (₹{test.price}) - {test.category}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <input value={labNotes} onChange={(e) => setLabNotes(e.target.value)} placeholder="Clinical indication / notes" className="w-full px-2.5 py-2 text-xs bg-white border border-slate-300 rounded-md" />
                  </div>
                  <button type="button" onClick={handleAddLabTest} disabled={!selectedLabTestId} className="md:col-span-1 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs rounded-md">Add</button>
                </div>
                {labOrders.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left"><thead className="bg-slate-100"><tr><th className="px-3 py-2">Test</th><th className="px-3 py-2">Sample</th><th className="px-3 py-2 text-right">Fee</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">{labOrders.map((test, idx) => <tr key={test.labTestId}><td className="px-3 py-2.5 font-bold">{test.name}</td><td className="px-3 py-2.5 text-slate-600">{labTests.find((item) => item.id === test.labTestId)?.sample || test.notes || '-'}</td><td className="px-3 py-2.5 text-right font-mono font-bold">₹{test.totalPrice}</td><td className="px-3 py-2.5 text-right"><button type="button" onClick={() => handleRemoveLabTest(idx)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 className="w-3.5 h-3.5" /></button></td></tr>)}</tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Consultation Action Footer */}
              <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraftCaseSheet}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Save Draft Case Sheet
                </button>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={handleOpenPrescriptionPrint}
                    className="flex-1 sm:flex-none px-4 py-3 bg-white border border-teal-600 text-teal-800 hover:bg-teal-50 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Prescription (A5)</span>
                  </button>

                  {activeVisit && (
                    <button
                      type="button"
                      onClick={handleCompleteConsultation}
                      className="flex-1 sm:flex-none px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>Finish Consultation & Free Room</span>
                    </button>
                  )}
                </div>
              </div>
            </>
              )}
            </>
          ) : (
            <div className="py-20 text-center space-y-4">
              <Stethoscope className="w-12 h-12 text-slate-300 mx-auto" />
              <div>
                <h4 className="text-base font-bold text-slate-800">
                  No Patient Currently In Consultation
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  Select an assigned patient from My Queue to call them and open their case sheet.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* STAGE 3 TEMPLATE ADD / EDIT MODAL */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden animate-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  {editingTemplateId ? 'Edit Clinical Template' : 'Create New Clinical Template'}
                </h3>
                <p className="text-xs text-slate-500">
                  Scoped to <strong>{currentDoctor.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplateForm} className="p-6 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Template Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Bronchitis Protocol"
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Standard Diagnosis *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acute Viral Bronchitis"
                  value={templateForm.diagnosis}
                  onChange={(e) => setTemplateForm({ ...templateForm, diagnosis: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:border-teal-500 focus:outline-hidden font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Chief Complaint</label>
                <textarea
                  rows={2}
                  placeholder="Standard presenting complaints..."
                  value={templateForm.chiefComplaint}
                  onChange={(e) => setTemplateForm({ ...templateForm, chiefComplaint: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Examination Findings</label>
                <textarea
                  rows={2}
                  placeholder="Standard exam notes..."
                  value={templateForm.examination}
                  onChange={(e) => setTemplateForm({ ...templateForm, examination: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Plan / Advice</label>
                <textarea
                  rows={2}
                  placeholder="Standard patient advice and instructions..."
                  value={templateForm.plan}
                  onChange={(e) => setTemplateForm({ ...templateForm, plan: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded border border-amber-200 text-amber-800 text-[11px]">
                Note: Deleting or modifying a template does not alter clinical notes previously entered for patients.
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTemplateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer shadow-xs"
                >
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ALLERGY WARNING OVERRIDE MODAL */}
      {allergyAlertOpen && pendingAllergicDrug && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-rose-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border-2 border-rose-500 overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 bg-rose-600 text-white flex items-center gap-3">
              <AlertTriangle className="w-7 h-7 text-white shrink-0 animate-bounce" />
              <div>
                <h3 className="text-base font-black tracking-wide uppercase">
                  SEVERE ALLERGY CONTRAINDICATION ALERT
                </h3>
                <p className="text-xs text-rose-100">
                  Critical Patient Safety Warning · Clinical Override Required
                </p>
              </div>
            </div>

            <div className="p-6 space-y-4 text-slate-800">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                <div className="text-xs text-rose-800 font-bold">
                  Patient Allergy on File: <span className="underline">{pendingAllergicDrug.matchingAllergy}</span>
                </div>
                <div className="text-xs text-slate-700">
                  Attempted Drug: <strong>{pendingAllergicDrug.drug.name}</strong> ({pendingAllergicDrug.drug.genericName})
                </div>
                <div className="text-[11px] text-rose-700 italic">
                  This medication matches the allergy class {pendingAllergicDrug.matchingAllergy} and may provoke severe hypersensitivity or anaphylaxis!
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-900 mb-1">
                  MANDATORY CLINICAL REASON TO OVERRIDE *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Type the clinical justification, previous tolerance, or desensitisation rationale..."
                  value={allergyOverrideReason}
                  onChange={(e) => setAllergyOverrideReason(e.target.value)}
                  className="w-full p-2.5 text-xs border border-rose-300 rounded-lg focus:border-rose-600 focus:outline-hidden"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  This justification is permanently stored in the audit trail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setAllergyAlertOpen(false);
                    setPendingAllergicDrug(null);
                    setAllergyOverrideReason('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel (Do Not Prescribe)
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAllergyOverride}
                  className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Confirm Clinical Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* A5 HALF-A4 PRESCRIPTION PRINT MODAL */}
      {showPrescriptionModal && consultationVisit && consultationPatient && (
        <PrescriptionPrintModal
          visit={{
            ...consultationVisit,
            prescriptions: [...prescriptions],
            caseSheet: {
              ...caseSheet,
              diagnosis: caseSheet.diagnosis || consultationVisit.caseSheet?.diagnosis || 'Outpatient Consultation'
            }
          }}
          patient={consultationPatient}
          doctor={currentDoctor}
          settings={settings}
          onClose={() => setShowPrescriptionModal(false)}
        />
      )}

      {/* VISIT HISTORY MODAL */}
      {showVisitHistoryModal && consultationPatient && (
        <VisitHistoryModal
          patient={consultationPatient}
          visits={visits}
          doctors={doctors}
          bills={bills}
          onCopyVisit={handleCopyPreviousVisit}
          onClose={() => setShowVisitHistoryModal(false)}
        />
      )}

      {/* LAB INVESTIGATION PRINT MODAL */}
      {labPrintOpen && consultationVisit && (
        <LabInvestigationPrintModal
          visitId={labPrintOpen.visitId}
          patientName={labPrintOpen.patientName}
          patientMrn={labPrintOpen.patientMrn}
          tokenNumber={labPrintOpen.tokenNumber}
          labOrders={labPrintOpen.labOrders}
          onClose={() => setLabPrintOpen(null)}
          onPrint={async (id) => {
            // Record print event in audit log
            return true;
          }}
        />
      )}
    </div>
  );
};
