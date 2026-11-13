import React, { useMemo } from 'react';
import { TokenVisit, Patient, Doctor, ClinicSettings } from '../types';
import { useClinic } from '../context/ClinicContext';
import { Printer, X, ShieldAlert, Stethoscope } from 'lucide-react';

interface PrescriptionPrintModalProps {
  visit: TokenVisit;
  patient?: Patient;
  doctor?: Doctor;
  settings?: ClinicSettings;
  onClose: () => void;
}

export const PrescriptionPrintModal: React.FC<PrescriptionPrintModalProps> = ({
  visit,
  patient: propPatient,
  doctor: propDoctor,
  settings: propSettings,
  onClose,
}) => {
  const { patients, doctors, visits, settings: ctxSettings, recordDocumentPrint } = useClinic();

  // Memoized lookup maps for efficient O(1) access
  const patientMap = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  // STAGE C RULE: Print prescription reads the saved prescription at the moment of print.
  // It must include every medicine saved, including newly added drugs.
  const latestVisit = visits.find((v) => v.id === visit.id);
  const effectivePrescriptions =
    visit.prescriptions && visit.prescriptions.length >= (latestVisit?.prescriptions?.length || 0)
      ? visit.prescriptions
      : (latestVisit?.prescriptions || visit.prescriptions || []);

  const patient: Patient =
    propPatient ||
    patientMap.get(visit.patientId) || {
      id: visit.patientId,
      mrn: 'PJ-UNKNOWN',
      name: 'Patient',
      age: 0,
      sex: 'Other',
      phone: '',
      allergies: [],
      pastHistory: '',
      registeredAt: visit.timestamp,
    };

  const doctor: Doctor =
    propDoctor ||
    doctorMap.get(visit.doctorId) ||
    doctors[0] || {
      id: 'doc-1',
      name: 'Doctor (placeholder)',
      specialty: 'General Medicine',
      qualification: 'MBBS',
      registrationNumber: 'KL/REG/001',
      tokenPrefix: 'D1',
      consultationFee: 300,
    };

  const settings: ClinicSettings = propSettings || ctxSettings;

  const handlePrint = async () => {
    await recordDocumentPrint('prescription', visit.id);
    window.print();
  };

  const formattedDate = new Date(visit.timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-teal-700" />
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Official Clinical Prescription Sheet (A5 Portrait, 148 × 210 mm)
              </h3>
              <p className="text-xs text-slate-500">
                Token: <strong className="font-mono text-slate-800">{visit.tokenNumber}</strong> · Patient: {patient.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{(visit.printCount || 0) > 0 ? 'Reprint A5 Prescription' : 'Print A5 Prescription'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prescription Sheet Container */}
        <div className="p-6 bg-slate-100 flex-1 overflow-y-auto flex justify-center items-start print:p-0 print:bg-white print:overflow-visible">
          {/* A5 Printable Canvas (148mm x 210mm) */}
          <div
            id="a5-prescription-print-area"
            className="bg-white border border-slate-300 shadow-md p-6 text-slate-900 w-[148mm] min-h-[210mm] text-[11px] leading-relaxed flex flex-col justify-between font-sans print:border-none print:shadow-none print:p-0 print:w-full print:min-h-0 select-none"
          >
            {/* Header: Clinic Settings */}
            <div>
              <div className="pb-3 border-b-2 border-slate-900 flex justify-between items-start">
                <div className="flex items-start gap-3">
                  <img src="/clinic-logo.jpg" alt="PJ Medical Center logo" className="w-16 h-16 object-contain" />
                  <div>
                  <h1 className="text-base font-black uppercase tracking-wider text-slate-950">
                    {settings.clinicName}
                  </h1>
                  <p className="text-[10px] text-slate-600 leading-tight mt-0.5">
                    {settings.address}
                  </p>
                  <p className="text-[10px] text-slate-600">
                    Ph: {settings.phone} · Reg: {settings.regNumber}
                  </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black font-mono tracking-widest text-teal-800">
                    {visit.tokenNumber}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">Date: {formattedDate}</div>
                </div>
              </div>

              {/* Doctor Details */}
              <div className="py-2.5 border-b border-slate-200 flex justify-between items-center text-xs">
                <div>
                  <span className="font-bold text-slate-900 text-sm">{doctor.name}</span>
                  <div className="text-[11px] text-slate-600">
                    {doctor.specialty} · {doctor.qualification}
                  </div>
                </div>
                <div className="text-right text-[10px] text-slate-500 font-mono">
                  Reg No: {doctor.registrationNumber}
                </div>
              </div>

              {/* Patient Demographics */}
              <div className="py-2.5 border-b border-slate-200 bg-slate-50/70 p-2.5 rounded text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span>
                    <strong>Patient Name:</strong> {patient.name}
                  </span>
                  <span>
                    <strong>MRN:</strong> <span className="font-mono">{patient.mrn}</span>
                  </span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>
                    <strong>Age / Sex:</strong> {patient.age} yrs / {patient.sex}
                  </span>
                  <span>
                    <strong>Mobile:</strong> <span className="font-mono">{patient.phone}</span>
                  </span>
                </div>
                {patient.allergies.length > 0 && (
                  <div className="text-rose-700 font-bold flex items-center gap-1 pt-0.5 text-[10px]">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Known Drug Allergies: {patient.allergies.join(', ')}</span>
                  </div>
                )}
              </div>

              {/* Diagnosis & Clinical Findings */}
              <div className="py-3 border-b border-slate-200">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  CLINICAL DIAGNOSIS & IMPRESSION
                </div>
                <div className="font-bold text-xs text-slate-900 mt-0.5">
                  {visit.caseSheet?.diagnosis || 'Outpatient Consultation / Under Investigation'}
                </div>
                {visit.caseSheet?.chiefComplaint && (
                  <div className="text-[10px] text-slate-600 mt-1 italic">
                    Chief Complaint: {visit.caseSheet.chiefComplaint}
                  </div>
                )}
              </div>

              {/* Rx Symbol and Prescription Medicines */}
              <div className="py-3">
                <div className="flex items-center gap-1.5 pb-2 border-b border-slate-300 font-bold text-sm">
                  <span className="font-serif italic text-lg text-teal-800">℞</span>
                  <span className="uppercase tracking-wider text-xs">MEDICATION PRESCRIBED</span>
                </div>

                {effectivePrescriptions.length === 0 ? (
                  <div className="py-4 text-center text-xs text-slate-400 italic">
                    No pharmacological medications prescribed on this visit.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 text-[11px]">
                    {effectivePrescriptions.map((med, idx) => (
                      <div key={idx} className="py-2 space-y-0.5">
                        <div className="flex items-baseline justify-between font-bold text-slate-900">
                          <span>
                            {idx + 1}. {med.drugName} ({med.strength})
                          </span>
                          <span className="font-mono text-xs">
                            {med.dose} · {med.frequency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-600 text-[10px]">
                          <span>
                            Form: {med.form} · Duration: <strong className="font-mono">{med.duration}</strong>
                          </span>
                          {med.isOutsideMedicine && (
                            <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 uppercase text-[9px]">
                              Purchase outside
                            </span>
                          )}
                        </div>
                        {med.instructions && (
                          <div className="text-[10px] text-slate-500 italic">
                            Directions: {med.instructions}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {visit.caseSheet?.plan && (
                  <div className="mt-3 p-2 bg-slate-50 rounded border border-slate-200 text-[10px] text-slate-700">
                    <span className="font-bold block text-slate-900">General Advice / Review Plan:</span>
                    <p className="mt-0.5 whitespace-pre-line">{visit.caseSheet.plan}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Signature & Stamp Line */}
            <div className="pt-6 border-t border-slate-300 mt-4">
              <div className="flex justify-between items-end">
                <div className="text-[9px] text-slate-500 space-y-0.5">
                  <p>• Take medicines strictly as directed by the physician.</p>
                  <p>• In case of severe adverse reaction or allergy, report immediately.</p>
                  <p className="italic">Prototype Demo EMR · Not for actual medical practice</p>
                </div>

                <div className="text-center w-48">
                  <div className="border-b border-dashed border-slate-500 pb-8 text-xs font-mono text-slate-400">
                    [Doctor Signature & Stamp]
                  </div>
                  <div className="pt-1 text-[10px] font-bold text-slate-900">{doctor.name}</div>
                  <div className="text-[9px] text-slate-500">{doctor.qualification}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500 print:hidden">
          <span>Printing formatted for A5 Portrait (148 × 210 mm)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
