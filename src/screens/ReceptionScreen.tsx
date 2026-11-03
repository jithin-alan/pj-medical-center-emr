import React, { useState, useMemo } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  Patient,
  DoctorId,
  PaymentMethod,
  TokenVisit
} from '../types';
import {
  UserPlus,
  Search,
  Receipt,
  FileText,
  CreditCard,
  QrCode,
  Banknote,
  Printer,
  ChevronRight,
  Clock,
  History,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { PatientJourneyBar } from '../components/PatientJourneyBar';
import { VisitHistoryModal } from '../components/VisitHistoryModal';

export const ReceptionScreen: React.FC = () => {
  const {
    doctors,
    patients,
    visits,
    shifts,
    bills,
    labTests,
    userName,
    registerPatient,
    updatePatientAllergies,
    createTokenVisit,
    billProcedures,
    billWalkInLabs,
    setActiveReceiptBill,
    showToast,
    showConfirm,
  } = useClinic();

  // Active Reception Shift
  const activeShift = shifts.find(
    (s) => s.department === 'reception' && s.status === 'open'
  ) || shifts[0] || {
    id: 'temp-shift',
    department: 'reception',
    shiftType: 'Shift A',
    cashierName: userName,
    status: 'open',
    openedAt: new Date().toISOString(),
    openingCash: 2000,
  };

  // Tab State: 'registration_token' | 'procedure_billing' | 'tokens_list'
  const [activeTab, setActiveTab] = useState<'registration_token' | 'procedure_billing' | 'walk_in_lab' | 'tokens_list'>('registration_token');

  // Search state (accepts either Mobile or MR Number)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isRegisteringNew, setIsRegisteringNew] = useState(false);

  // Visit history modal
  const [historyPatient, setHistoryPatient] = useState<Patient | null>(null);

  // New Patient Form State
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    sex: 'Male' as 'Male' | 'Female' | 'Other',
    phone: '',
    allergies: '',
  });

  // Token Visit Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState<DoctorId>('doc-1');
  const [visitReason, setVisitReason] = useState('General medical checkup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [upiRef, setUpiRef] = useState('');

  // Procedure & Lab Billing State
  const [selectedProcVisitId, setSelectedProcVisitId] = useState<string | null>(null);
  const [walkInLabIds, setWalkInLabIds] = useState<string[]>([]);
  const [walkInName, setWalkInName] = useState('');
  const [walkInAge, setWalkInAge] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInSex, setWalkInSex] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [walkInPaymentMethod, setWalkInPaymentMethod] = useState<PaymentMethod>('cash');
  const [walkInUpiRef, setWalkInUpiRef] = useState('');

  // Existing Patient Allergy Edit State (Stage C)
  const [isEditingAllergies, setIsEditingAllergies] = useState(false);
  const [allergyInput, setAllergyInput] = useState('');

  const handleSavePatientAllergies = async () => {
    if (!selectedPatient) return;
    const list = allergyInput
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const ok = await updatePatientAllergies(selectedPatient.id, list);
    if (ok) {
      setIsEditingAllergies(false);
      setSelectedPatient({ ...selectedPatient, allergies: list });
    }
  };
  const selectedVisitForProcBilling = useMemo(
    () => visits.find((v) => v.id === selectedProcVisitId) || null,
    [visits, selectedProcVisitId]
  );
  const [procPaymentMethod, setProcPaymentMethod] = useState<PaymentMethod>('cash');
  const [procUpiRef, setProcUpiRef] = useState('');

  // STAGE 2: Auto-detect Search by MR Number vs Mobile Number
  const searchResults = useMemo(() => {
    const q = searchQuery.trim();
    if (!q || q.length < 2) return { isMrn: false, patients: [] };

    const isMrnQuery = q.toUpperCase().startsWith('PJ-') || /^PJ/i.test(q);

    if (isMrnQuery) {
      const match = patients.filter((p) => p.mrn.toUpperCase().includes(q.toUpperCase()));
      return { isMrn: true, patients: match };
    }

    // Phone query (digits)
    const cleanPhone = q.replace(/\D/g, '');
    if (cleanPhone.length < 3) return { isMrn: false, patients: [] };

    const matches = patients.filter((p) => {
      const pClean = p.phone.replace(/\D/g, '');
      return pClean.includes(cleanPhone) || cleanPhone.includes(pClean);
    });

    return { isMrn: false, patients: matches };
  }, [searchQuery, patients]);

  // If exact MRN found and not yet selected, offer direct select
  const handleSelectRevisit = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsRegisteringNew(false);
    showToast('info', `Selected ${patient.name} (${patient.mrn}) for revisit token.`, 'Patient Selected');
  };

  const handleStartNewRegistration = (presetPhone?: string) => {
    setSelectedPatient(null);
    setIsRegisteringNew(true);
    setFormData((prev) => ({
      ...prev,
      phone: presetPhone || (searchQuery.startsWith('+91') ? searchQuery : searchQuery ? `+91 ${searchQuery}` : '+91 9'),
    }));
  };

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();

    let targetPatient = selectedPatient;

    // If new registration
    if (isRegisteringNew || !targetPatient) {
      if (!formData.name.trim() || !formData.age || !formData.phone.trim()) {
        showToast('warning', 'Please fill patient full name, age, and phone number.');
        return;
      }

      const allergyList = formData.allergies
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      const registered = await registerPatient({
        name: formData.name,
        age: parseInt(formData.age, 10),
        sex: formData.sex,
        phone: formData.phone.startsWith('+91') ? formData.phone : `+91 ${formData.phone}`,
        allergies: allergyList,
      });

      if (!registered) return;
      targetPatient = registered;
      setSelectedPatient(registered);
      setIsRegisteringNew(false);
    }

    if (!targetPatient) {
      showToast('warning', 'Please select or register a patient.');
      return;
    }

    if (paymentMethod === 'upi' && !upiRef.trim()) {
      showToast('warning', 'Please enter UPI Transaction Reference number.');
      return;
    }

    const result = await createTokenVisit({
      patientId: targetPatient.id,
      doctorId: selectedDoctorId,
      reason: visitReason || 'Consultation',
      paymentMethod,
      upiRef: paymentMethod === 'upi' ? upiRef : undefined,
    });

    if (result) {
      // Reset forms
      setSelectedPatient(null);
      setSearchQuery('');
      setVisitReason('General medical checkup');
      setUpiRef('');
      setFormData({ name: '', age: '', sex: 'Male', phone: '', allergies: '' });
    }
  };

  const handlePayProcedureBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisitForProcBilling) return;

    if (procPaymentMethod === 'upi' && !procUpiRef.trim()) {
      showToast('warning', 'Please enter UPI Reference number for procedure bill.');
      return;
    }

    const currentVisitId = selectedVisitForProcBilling.id;
    const success = await billProcedures(
      currentVisitId,
      procPaymentMethod,
      procPaymentMethod === 'upi' ? procUpiRef : undefined
    );

    if (success) {
      // Keep this visit selected so reception immediately sees the BILLED status with invoice number!
      setSelectedProcVisitId(currentVisitId);
      setProcUpiRef('');
    }
  };

  const handleWalkInLabBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkInLabIds.length) {
      showToast('warning', 'Select at least one laboratory test.');
      return;
    }
    if (!selectedPatient && (!walkInName.trim() || !walkInAge || !walkInPhone.trim())) {
      showToast('warning', 'Enter walk-in patient name, age, and phone, or select an existing patient.');
      return;
    }
    if (walkInPaymentMethod === 'upi' && !walkInUpiRef.trim()) {
      showToast('warning', 'Enter the UPI reference for the lab bill.');
      return;
    }
    const success = await billWalkInLabs({
      patientId: selectedPatient?.id,
      name: selectedPatient?.name || walkInName.trim(),
      age: selectedPatient?.age || Number(walkInAge),
      sex: selectedPatient?.sex || walkInSex,
      phone: selectedPatient?.phone || walkInPhone.trim(),
      labTestIds: walkInLabIds,
      paymentMethod: walkInPaymentMethod,
      upiRef: walkInPaymentMethod === 'upi' ? walkInUpiRef.trim() : undefined,
    });
    if (success) {
      setWalkInLabIds([]); setWalkInUpiRef(''); setWalkInName(''); setWalkInAge(''); setWalkInPhone('');
    }
  };

  // Patients waiting for procedure billing (UNBILLED)
  const procedurePendingVisits = useMemo(() => {
    return visits.filter(
      (v) => v.procedureOrders.some((p) => p.status === 'UNBILLED' || (!p.billed && p.status !== 'GIVEN')) || (v.labOrders || []).some((lab) => lab.status === 'UNBILLED' || !lab.billed)
    );
  }, [visits]);

  // Patients with billed or given procedures (Live status tracker)
  const procedureBilledOrDoneVisits = useMemo(() => {
    return visits.filter(
      (v) =>
        (v.procedureOrders.length > 0 && v.procedureOrders.some((p) => p.status === 'BILLED' || p.status === 'GIVEN')) ||
        ((v.labOrders || []).length > 0 && (v.labOrders || []).some((lab) => lab.status === 'BILLED' || lab.status === 'REPORTED'))
    );
  }, [visits]);

  return (
    <div className="space-y-6">
      {/* Shift & Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Reception & Cashier Counter</span>
            <span className="text-xs px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 font-medium">
              {activeShift.shiftType}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cashier: <strong className="text-slate-700">{userName}</strong> · Shift Opening Float: ₹{activeShift.openingCash.toLocaleString('en-IN')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg">
          <button
            onClick={() => setActiveTab('registration_token')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'registration_token'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New Token & Registration
          </button>
          <button
            onClick={() => setActiveTab('procedure_billing')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors relative cursor-pointer ${
              activeTab === 'procedure_billing'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Procedure & Lab Billing</span>
            {procedurePendingVisits.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {procedurePendingVisits.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('walk_in_lab')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${activeTab === 'walk_in_lab' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
          >Walk-in Lab Bill</button>
          <button
            onClick={() => setActiveTab('tokens_list')}
            className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              activeTab === 'tokens_list'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Today's Tokens ({visits.length})
          </button>
        </div>
      </div>

      {/* TAB 1: REGISTRATION & TOKEN ISSUANCE */}
      {activeTab === 'registration_token' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Smart Lookup by Mobile or MRN (5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide">
                  1. Lookup Patient (MRN or Mobile)
                </label>
                <span className="text-[10px] font-mono text-teal-700 font-medium">
                  Auto-Detects Format
                </span>
              </div>

              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Type MRN (e.g. PJ-000001) or Mobile (+91...)"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value) {
                      setSelectedPatient(null);
                      setIsRegisteringNew(false);
                    }
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono text-slate-900 focus:bg-white focus:border-teal-500 focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                {searchQuery.toUpperCase().startsWith('PJ') ? (
                  <span className="text-teal-700 font-semibold">🔍 Searching by permanent MR Number...</span>
                ) : (
                  <span>Type 10-digit phone to list all family members registered on that number.</span>
                )}
              </p>
            </div>

            {/* Results based on lookup */}
            {searchQuery.trim().length >= 2 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">
                    Matches ({searchResults.patients.length} found)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleStartNewRegistration(searchQuery)}
                    className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Register as new patient</span>
                  </button>
                </div>

                {searchResults.patients.length === 0 ? (
                  <div className="py-3 text-center text-xs text-slate-500">
                    <p>No patient record matches "{searchQuery}".</p>
                    <button
                      type="button"
                      onClick={() => handleStartNewRegistration(searchQuery)}
                      className="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Create New Patient Record</span>
                    </button>
                  </div>
                ) : searchResults.isMrn && searchResults.patients.length === 1 ? (
                  // Exact MRN Match: Direct open
                  <div className="p-3.5 bg-white border border-teal-300 rounded-lg shadow-xs space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          Direct MRN Match Found
                        </span>
                        <h4 className="text-base font-bold text-slate-900 mt-1">
                          {searchResults.patients[0].name}
                        </h4>
                        <div className="text-xs text-slate-600 mt-0.5 space-x-2">
                          <span>MRN: <strong className="font-mono text-slate-800">{searchResults.patients[0].mrn}</strong></span>
                          <span>·</span>
                          <span>{searchResults.patients[0].age} yrs ({searchResults.patients[0].sex})</span>
                          <span>·</span>
                          <span>{searchResults.patients[0].phone}</span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5 items-end">
                        <button
                          type="button"
                          onClick={() => handleSelectRevisit(searchResults.patients[0])}
                          className="px-3 py-1.5 text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 rounded-lg cursor-pointer"
                        >
                          Select Patient
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryPatient(searchResults.patients[0])}
                          className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3 h-3 text-slate-400" />
                          <span>Visit History</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Mobile or Multiple Matches: Explicit Picker (Never auto-select!)
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 font-medium bg-amber-50 p-2 rounded border border-amber-200">
                      {searchResults.patients.length} patient(s) found. Select the correct individual:
                    </p>
                    {searchResults.patients.map((patient) => (
                      <div
                        key={patient.id}
                        className={`p-3 bg-white border rounded-lg transition-all flex items-center justify-between ${
                          selectedPatient?.id === patient.id
                            ? 'border-teal-500 bg-teal-50/40 ring-1 ring-teal-500'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-slate-900">{patient.name}</div>
                          <div className="text-xs text-slate-500">
                            MRN: <span className="font-mono font-bold text-slate-800">{patient.mrn}</span> · {patient.age} yrs · {patient.sex}
                          </div>
                          {patient.allergies.length > 0 && (
                            <span className="text-[10px] text-rose-600 font-semibold block mt-0.5">
                              ⚠️ Allergies: {patient.allergies.join(', ')}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setHistoryPatient(patient)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded"
                            title="View past visit history"
                          >
                            <History className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectRevisit(patient)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                              selectedPatient?.id === patient.id
                                ? 'bg-teal-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                          >
                            {selectedPatient?.id === patient.id ? 'Selected' : 'Select'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Always-available button to register new patient */}
            {!isRegisteringNew && (
              <button
                type="button"
                onClick={() => handleStartNewRegistration()}
                className="w-full py-2.5 border-2 border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4 text-slate-500" />
                <span>+ Register As New Patient</span>
              </button>
            )}

            {/* Registration Form when registering new */}
            {isRegisteringNew && (
              <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-lg space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-teal-200/60">
                  <span className="text-xs font-bold text-teal-900 uppercase">
                    New Patient Demographic Form
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsRegisteringNew(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Suresh Kumar"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Age (Years) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="120"
                      placeholder="e.g. 42"
                      value={formData.age}
                      onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Sex *
                    </label>
                    <select
                      value={formData.sex}
                      onChange={(e) => setFormData({ ...formData, sex: e.target.value as any })}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Mobile Number (+91) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+91 98470 12345"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Known Drug Allergies (Optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Penicillins, Sulphonamides"
                    value={formData.allergies}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:border-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Token Generation & Consultation Fee Payment (7 Cols) */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide pb-3 border-b border-slate-200 flex items-center justify-between">
              <span>2. Token & Consultation Fee Payment</span>
              <span className="text-xs font-mono text-teal-700 font-semibold">Consultation: ₹300</span>
            </h3>

            {/* Selected Patient Banner */}
            <div className="my-4 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
              {selectedPatient ? (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700">
                        Selected Patient for Token
                      </span>
                      <h4 className="text-base font-bold text-slate-900">{selectedPatient.name}</h4>
                      <p className="text-xs text-slate-500">
                        MRN: <strong className="font-mono text-slate-800">{selectedPatient.mrn}</strong> · {selectedPatient.age} yrs · {selectedPatient.sex} · {selectedPatient.phone}
                      </p>
                      {selectedPatient.allergies.length > 0 ? (
                        <p className="text-xs text-rose-600 font-bold mt-1">
                          ⚠️ Allergies: {selectedPatient.allergies.join(', ')}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 mt-1">
                          No recorded allergies
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAllergyInput(selectedPatient.allergies.join(', '));
                          setIsEditingAllergies(!isEditingAllergies);
                        }}
                        className="px-2.5 py-1 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded hover:bg-rose-100 cursor-pointer"
                      >
                        {isEditingAllergies ? 'Cancel' : 'Edit Allergies'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryPatient(selectedPatient)}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-50 cursor-pointer"
                      >
                        Visit History
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPatient(null)}
                        className="text-xs font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                      >
                        Change
                      </button>
                    </div>
                  </div>

                  {/* Inline Allergy Editor for Existing Patient */}
                  {isEditingAllergies && (
                    <div className="mt-3 pt-3 border-t border-rose-200 bg-rose-50/50 p-2.5 rounded-lg flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Enter allergies separated by comma (e.g. Penicillins, Sulphonamides)"
                        value={allergyInput}
                        onChange={(e) => setAllergyInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded focus:border-rose-500 focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleSavePatientAllergies}
                        className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded cursor-pointer shadow-2xs whitespace-nowrap"
                      >
                        Save Allergies
                      </button>
                    </div>
                  )}
                </>
              ) : isRegisteringNew ? (
                <div className="text-xs text-teal-800 font-medium">
                  Patient registration in progress: {formData.name || 'New Patient'}. Submitting this form will register the patient and generate the token.
                </div>
              ) : (
                <div className="text-xs text-slate-500 italic">
                  No patient selected yet. Search by MRN or mobile number on the left.
                </div>
              )}
            </div>

            <form onSubmit={handleCreateToken} className="space-y-4">
              {/* Doctor Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Select Consulting Doctor *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {doctors.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        selectedDoctorId === doc.id
                          ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 font-mono text-slate-700">
                          {doc.tokenPrefix}-###
                        </span>
                        <span className="text-xs font-bold font-mono text-slate-900">
                          ₹{doc.consultationFee}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900 mt-1">{doc.name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{doc.specialty}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Visit Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Visit Reason / Complaints
                </label>
                <input
                  type="text"
                  placeholder="e.g. Fever for 2 days, prescription renewal, joint pain"
                  value={visitReason}
                  onChange={(e) => setVisitReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              {/* Payment Mode */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Consultation Fee Payment Mode (₹300) *
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <label
                    className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      paymentMethod === 'cash'
                        ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cash"
                      checked={paymentMethod === 'cash'}
                      onChange={() => setPaymentMethod('cash')}
                      className="hidden"
                    />
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs">Cash</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      paymentMethod === 'upi'
                        ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={() => setPaymentMethod('upi')}
                      className="hidden"
                    />
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span className="text-xs">UPI</span>
                  </label>

                  <label
                    className={`flex items-center justify-center gap-2 p-3 border rounded-lg cursor-pointer transition-all ${
                      paymentMethod === 'card'
                        ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
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
                  <div className="mt-2.5">
                    <input
                      type="text"
                      placeholder="Enter UPI Reference / UTR Number (e.g. UPI/4920194829)"
                      value={upiRef}
                      onChange={(e) => setUpiRef(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-blue-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!selectedPatient && !isRegisteringNew}
                  className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-5 h-5" />
                  <span>Receive ₹300, Issue Token & Print Receipt</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: PROCEDURE BILLING (Second Visit) */}
      {activeTab === 'procedure_billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
            {/* 1. Pending Unbilled Section */}
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                  <span>Pending Billing</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800 font-mono">
                    {procedurePendingVisits.length}
                  </span>
                </h3>
                <span className="text-xs text-slate-500">Unbilled orders</span>
              </div>

              {procedurePendingVisits.length === 0 ? (
                <div className="py-6 text-center text-slate-500 text-xs italic">
                  No patients awaiting unbilled procedure payments.
                </div>
              ) : (
                <div className="space-y-2 mt-2.5">
                  {procedurePendingVisits.map((v) => {
                    const pat = patients.find((p) => p.id === v.patientId);
                    const unbilled = v.procedureOrders.filter((p) => p.status === 'UNBILLED' || (!p.billed && p.status !== 'GIVEN'));
                    const unbilledTotal = unbilled.reduce((sum, item) => sum + item.totalPrice, 0);

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedProcVisitId(v.id)}
                        className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                          selectedVisitForProcBilling?.id === v.id
                            ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-base text-slate-900">
                            {v.tokenNumber}
                          </span>
                          <span className="font-mono font-bold text-sm text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            Due: ₹{unbilledTotal}
                          </span>
                        </div>
                        <div className="font-semibold text-sm text-slate-800 mt-1">
                          {pat?.name} ({pat?.mrn})
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {unbilled.length} unbilled item(s) ordered by {doctors.find((d) => d.id === v.doctorId)?.name}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Billed & In Treatment Live Tracker */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-sm font-bold text-slate-900 uppercase flex items-center gap-2">
                  <span>Billed / In Treatment</span>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-emerald-100 text-emerald-800 font-mono">
                    {procedureBilledOrDoneVisits.length}
                  </span>
                </h3>
                <span className="text-[11px] text-teal-700 font-medium">Live Status</span>
              </div>

              {procedureBilledOrDoneVisits.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs italic">
                  No active billed procedure orders yet.
                </div>
              ) : (
                <div className="space-y-2 mt-2.5">
                  {procedureBilledOrDoneVisits.map((v) => {
                    const pat = patients.find((p) => p.id === v.patientId);
                    const allGiven = v.procedureOrders.every((p) => p.status === 'GIVEN' || p.nurseGiven);

                    return (
                      <div
                        key={v.id}
                        onClick={() => setSelectedProcVisitId(v.id)}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          selectedVisitForProcBilling?.id === v.id
                            ? 'border-teal-600 bg-teal-50/50 ring-1 ring-teal-600'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-sm text-slate-900">
                            {v.tokenNumber}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              allGiven
                                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            }`}
                          >
                            {allGiven ? 'GIVEN (DONE)' : 'BILLED (IN TREATMENT)'}
                          </span>
                        </div>
                        <div className="font-medium text-xs text-slate-800 mt-1">
                          {pat?.name} ({pat?.mrn})
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Invoice: #{v.procedureBillId || 'Paid'} · {v.procedureOrders.length} order item(s)
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 uppercase pb-3 border-b border-slate-200">
              Procedure Invoice & Order Status
            </h3>

            {selectedVisitForProcBilling ? (
              (() => {
                const pat = patients.find((p) => p.id === selectedVisitForProcBilling.patientId);
                const unbilledItems = [
                  ...selectedVisitForProcBilling.procedureOrders.filter(
                    (p) => p.status === 'UNBILLED' || (!p.billed && p.status !== 'GIVEN')
                  ),
                  ...(selectedVisitForProcBilling.labOrders || []).filter(
                    (lab) => lab.status === 'UNBILLED' || !lab.billed
                  ),
                ];
                const subtotal = unbilledItems.reduce((sum, item) => sum + item.totalPrice, 0);
                const matchingBill = bills.find(
                  (b) => b.type === 'procedure' && (b.visitId === selectedVisitForProcBilling.id || b.invoiceNo === selectedVisitForProcBilling.procedureBillId)
                );

                // If patient has unbilled procedure items: Show billing payment form
                if (unbilledItems.length > 0) {
                  return (
                    <form onSubmit={handlePayProcedureBill} className="space-y-5 mt-4">
                      <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-xs text-slate-500 uppercase font-bold">Patient Details</div>
                            <div className="text-base font-bold text-slate-900">{pat?.name}</div>
                            <div className="text-xs text-slate-600">
                              MRN: {pat?.mrn} · Token: {selectedVisitForProcBilling.tokenNumber}
                            </div>
                            {pat?.allergies && pat.allergies.length > 0 && (
                              <div className="text-xs text-rose-600 font-bold mt-1">
                                ⚠️ Allergies: {pat.allergies.join(', ')}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-xs text-slate-500 block">Total Due</span>
                            <span className="text-2xl font-black font-mono text-teal-700">
                              ₹{subtotal}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="text-xs font-bold text-slate-700 uppercase mb-2">
                          Doctor's Prescribed Procedure Items (Excludes Pharmacy Medicines)
                        </div>
                        <div className="border border-slate-200 rounded-lg overflow-hidden">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                              <tr>
                                <th className="px-3 py-2">Item Description</th>
                                <th className="px-3 py-2 text-center">Qty</th>
                                <th className="px-3 py-2 text-right">Unit (₹)</th>
                                <th className="px-3 py-2 text-right">Total (₹)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {unbilledItems.map((item, i) => (
                                <tr key={i} className="hover:bg-slate-50">
                                  <td className="px-3 py-2.5 font-medium text-slate-900">
                                    <div className="flex items-center gap-2">
                                      <span>{item.name}</span>
                                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                        UNBILLED
                                      </span>
                                    </div>
                                    {item.notes && (
                                      <div className="text-[10px] text-slate-500 italic mt-0.5">
                                        Notes: {item.notes}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-2.5 text-center font-mono">{item.qty}</td>
                                  <td className="px-3 py-2.5 text-right font-mono">₹{item.unitPrice}</td>
                                  <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900">
                                    ₹{item.totalPrice}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          Procedure Payment Mode *
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                          <label
                            className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                              procPaymentMethod === 'cash'
                                ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="procPayment"
                              value="cash"
                              checked={procPaymentMethod === 'cash'}
                              onChange={() => setProcPaymentMethod('cash')}
                              className="hidden"
                            />
                            <Banknote className="w-4 h-4 text-emerald-600" />
                            <span className="text-xs">Cash</span>
                          </label>
                          <label
                            className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                              procPaymentMethod === 'upi'
                                ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="procPayment"
                              value="upi"
                              checked={procPaymentMethod === 'upi'}
                              onChange={() => setProcPaymentMethod('upi')}
                              className="hidden"
                            />
                            <QrCode className="w-4 h-4 text-blue-600" />
                            <span className="text-xs">UPI</span>
                          </label>
                          <label
                            className={`flex items-center justify-center gap-2 p-2.5 border rounded-lg cursor-pointer ${
                              procPaymentMethod === 'card'
                                ? 'border-teal-600 bg-teal-50/50 font-bold text-teal-900'
                                : 'border-slate-200 text-slate-700'
                            }`}
                          >
                            <input
                              type="radio"
                              name="procPayment"
                              value="card"
                              checked={procPaymentMethod === 'card'}
                              onChange={() => setProcPaymentMethod('card')}
                              className="hidden"
                            />
                            <CreditCard className="w-4 h-4 text-purple-600" />
                            <span className="text-xs">Card</span>
                          </label>
                        </div>

                        {procPaymentMethod === 'upi' && (
                          <div className="mt-2">
                            <input
                              type="text"
                              placeholder="UPI Reference No."
                              value={procUpiRef}
                              onChange={(e) => setProcUpiRef(e.target.value)}
                              className="w-full px-3 py-2 text-xs font-mono bg-white border border-blue-300 rounded-md focus:border-blue-500 focus:outline-hidden"
                            />
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Receipt className="w-4 h-4" />
                        <span>Collect ₹{subtotal}, Print Procedure & Lab Bill & Route to Nurse</span>
                      </button>
                    </form>
                  );
                }

                // If patient procedure orders are already billed: Show live order tracker
                const paidTotal = selectedVisitForProcBilling.procedureOrders.reduce((sum, p) => sum + p.totalPrice, 0);

                return (
                  <div className="space-y-5 mt-4">
                    {/* Billed Success Banner */}
                    <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="font-bold text-emerald-950 text-sm">
                            Procedure & Lab Bill Settled at Reception
                          </span>
                        </div>
                        <p className="text-xs text-emerald-800 mt-1">
                          Invoice: <strong className="font-mono">{selectedVisitForProcBilling.procedureBillId || matchingBill?.invoiceNo || 'REC-PAID'}</strong> · Amount: <strong>₹{paidTotal}</strong>
                        </p>
                      </div>

                      {matchingBill && (
                        <button
                          type="button"
                          onClick={() => setActiveReceiptBill(matchingBill)}
                          className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>View Invoice #{matchingBill.invoiceNo}</span>
                        </button>
                      )}
                    </div>

                    {/* Patient Summary Card */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="text-slate-500 uppercase font-bold text-[10px] block">Patient</span>
                        <strong className="text-slate-900 text-sm">{pat?.name}</strong>{' '}
                        <span className="text-slate-500 font-mono">({pat?.mrn})</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500 uppercase font-bold text-[10px] block">Token</span>
                        <span className="font-mono font-bold text-base text-slate-900">
                          {selectedVisitForProcBilling.tokenNumber}
                        </span>
                      </div>
                    </div>

                    {/* Live Order Status Table */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Live Procedure & Lab Orders ({selectedVisitForProcBilling.procedureOrders.length})
                        </span>
                        <span className="text-[11px] font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                          <span>Live synced with Nurse Screen</span>
                        </span>
                      </div>

                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-100 text-slate-700 uppercase font-semibold">
                            <tr>
                              <th className="px-3 py-2.5">Procedure Order</th>
                              <th className="px-3 py-2.5 text-center">Qty</th>
                              <th className="px-3 py-2.5 text-right">Total</th>
                              <th className="px-3 py-2.5 text-center">Live Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedVisitForProcBilling.procedureOrders.map((item, idx) => {
                              const isGiven = item.status === 'GIVEN' || item.nurseGiven;
                              const isBilled = item.status === 'BILLED' || (!isGiven && item.billed);

                              return (
                                <tr key={idx} className="hover:bg-slate-50">
                                  <td className="px-3 py-3">
                                    <div className="font-bold text-slate-900">{item.name}</div>
                                    {item.notes && (
                                      <div className="text-[11px] text-slate-500 italic mt-0.5">
                                        Note: {item.notes}
                                      </div>
                                    )}
                                    {isGiven && (
                                      <div className="text-[11px] text-teal-700 font-medium mt-1">
                                        ✓ Administered by {item.nurseName || 'Nurse'}
                                        {item.nurseGivenAt ? ` at ${new Date(item.nurseGivenAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-3 py-3 text-center font-mono">{item.qty}</td>
                                  <td className="px-3 py-3 text-right font-mono font-bold">₹{item.totalPrice}</td>
                                  <td className="px-3 py-3 text-center">
                                    {isGiven ? (
                                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-teal-100 text-teal-900 border border-teal-300 inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                                        <span>GIVEN</span>
                                      </span>
                                    ) : isBilled ? (
                                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 inline-flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>BILLED</span>
                                        {item.billInvoiceNo && <span className="font-mono text-[10px]">({item.billInvoiceNo})</span>}
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        <span>UNBILLED</span>
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

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 flex items-center justify-between">
                      <span>
                        Stage: <strong className="text-slate-800">{selectedVisitForProcBilling.status.replace(/_/g, ' ')}</strong>
                      </span>
                      <span className="text-slate-500">
                        {selectedVisitForProcBilling.procedureOrders.every((p) => p.status === 'GIVEN' || p.nurseGiven)
                          ? 'All procedures administered by nurse.'
                          : 'Patient currently in treatment room with nursing staff.'}
                      </span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="py-16 text-center text-xs text-slate-400 italic">
                Select a patient from the left column to prepare procedure invoice and collect payment.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: WALK-IN LAB BILL */}
      {activeTab === 'walk_in_lab' && (
        <form onSubmit={handleWalkInLabBilling} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase text-slate-900 border-b pb-3">Walk-in Patient Details</h3>
            {selectedPatient ? (
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg flex items-center justify-between">
                <div><div className="font-bold text-sm">{selectedPatient.name}</div><div className="text-xs text-slate-500">{selectedPatient.mrn} · {selectedPatient.phone}</div></div>
                <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs font-bold text-rose-600">Clear</button>
              </div>
            ) : (
              <>
                <input value={walkInName} onChange={(e) => setWalkInName(e.target.value)} placeholder="Patient full name *" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={walkInAge} onChange={(e) => setWalkInAge(e.target.value)} type="number" min="0" placeholder="Age *" className="px-3 py-2 border border-slate-300 rounded-lg text-sm" />
                  <select value={walkInSex} onChange={(e) => setWalkInSex(e.target.value as any)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm"><option>Male</option><option>Female</option><option>Other</option></select>
                </div>
                <input value={walkInPhone} onChange={(e) => setWalkInPhone(e.target.value)} placeholder="Mobile number *" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />
              </>
            )}
            <p className="text-[11px] text-slate-500">No doctor consultation or prescription is required for walk-in laboratory billing.</p>
            <div><label className="text-xs font-bold text-slate-700">Payment method</label><div className="grid grid-cols-3 gap-2 mt-2">
              {(['cash','upi','card'] as PaymentMethod[]).map((method) => <button type="button" key={method} onClick={() => setWalkInPaymentMethod(method)} className={`py-2 border rounded-lg text-xs font-bold capitalize ${walkInPaymentMethod === method ? 'border-teal-600 bg-teal-50 text-teal-700' : 'border-slate-200'}`}>{method}</button>)}
            </div></div>
            {walkInPaymentMethod === 'upi' && <input value={walkInUpiRef} onChange={(e) => setWalkInUpiRef(e.target.value)} placeholder="UPI reference *" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm" />}
          </div>
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase text-slate-900 border-b pb-3">Select Laboratory Tests</h3>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 border rounded-lg">
              {labTests.map((test) => { const checked = walkInLabIds.includes(test.id); return (
                <label key={test.id} className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50">
                  <input type="checkbox" checked={checked} onChange={(e) => setWalkInLabIds((ids) => e.target.checked ? [...ids, test.id] : ids.filter((id) => id !== test.id))} className="accent-teal-600" />
                  <div className="flex-1"><div className="font-bold text-sm">{test.name}</div><div className="text-[11px] text-slate-500">{test.category} · {test.sample || 'No sample'} · {test.turnaround || 'Same day'}</div></div>
                  <div className="font-mono font-bold">₹{test.price}</div>
                </label>
              ); })}
            </div>
            <div className="flex items-center justify-between pt-2">
              <div className="text-sm text-slate-600">Total: <strong className="text-lg text-slate-900">₹{labTests.filter((test) => walkInLabIds.includes(test.id)).reduce((sum, test) => sum + test.price, 0)}</strong></div>
              <button type="submit" className="px-5 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-bold">Collect Payment & Issue Lab Bill</button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 3: TODAY'S TOKENS LIST */}
      {activeTab === 'tokens_list' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase">
                Today's Patient Tokens Log ({visits.length})
              </h3>
              <p className="text-xs text-slate-500">Live outpatient visits across all doctors</p>
            </div>
          </div>

          <div className="space-y-3">
            {visits.map((v) => {
              const pat = patients.find((p) => p.id === v.patientId);
              const doc = doctors.find((d) => d.id === v.doctorId);

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-black font-mono text-teal-800 bg-white px-3 py-1 rounded-lg border border-teal-200">
                        {v.tokenNumber}
                      </span>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {pat?.name}{' '}
                          <span className="text-xs text-slate-500 font-mono">({pat?.mrn})</span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {doc?.name} · {v.reason} · Reg: {new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {pat?.allergies && pat.allergies.length > 0 && (
                          <div className="text-[10px] text-rose-600 font-bold mt-0.5">
                            ⚠️ Allergies: {pat.allergies.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {pat && (
                        <button
                          type="button"
                          onClick={() => setHistoryPatient(pat)}
                          className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5 text-slate-400" />
                          <span>Visit History</span>
                        </button>
                      )}
                      <span className="text-xs font-mono font-bold text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200">
                        Fee: ₹{v.fee} ({v.paymentMethod.toUpperCase()})
                      </span>
                    </div>
                  </div>

                  {/* Procedure & Lab Orders Live Status Badges */}
                  {v.procedureOrders.length > 0 && (
                    <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-bold text-slate-600 uppercase text-[10px]">
                        Procedure & Lab Orders:
                      </span>
                      {v.procedureOrders.map((p, idx) => {
                        const isGiven = p.status === 'GIVEN' || p.nurseGiven;
                        const isBilled = p.status === 'BILLED' || (!isGiven && p.billed);

                        return (
                          <span
                            key={idx}
                            className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold inline-flex items-center gap-1 ${
                              isGiven
                                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                                : isBilled
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }`}
                          >
                            <span>{p.name}:</span>
                            <span className="uppercase">{isGiven ? 'GIVEN' : isBilled ? 'BILLED' : 'UNBILLED'}</span>
                            {p.billInvoiceNo && <span className="text-[10px] opacity-75">({p.billInvoiceNo})</span>}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* 8-stage progress bar */}
                  <PatientJourneyBar visit={v} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISIT HISTORY MODAL */}
      {historyPatient && (
        <VisitHistoryModal
          patient={historyPatient}
          visits={visits}
          doctors={doctors}
          bills={bills}
          onClose={() => setHistoryPatient(null)}
        />
      )}
    </div>
  );
};
