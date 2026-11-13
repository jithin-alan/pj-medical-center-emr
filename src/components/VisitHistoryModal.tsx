import React, { useMemo } from 'react';
import { Patient, TokenVisit, Doctor, Bill } from '../types';
import { useClinic } from '../context/ClinicContext';
import { Clock, Calendar, Stethoscope, Pill, Syringe, Receipt, X, FileText } from 'lucide-react';

interface VisitHistoryModalProps {
  patient: Patient;
  visits?: TokenVisit[];
  doctors?: Doctor[];
  bills?: Bill[];
  onClose: () => void;
  onCopyVisit?: (visit: TokenVisit) => void;
}

export const VisitHistoryModal: React.FC<VisitHistoryModalProps> = ({
  patient,
  visits: propVisits,
  doctors: propDoctors,
  bills: propBills,
  onClose,
  onCopyVisit,
}) => {
  const { visits: ctxVisits, doctors: ctxDoctors, bills: ctxBills } = useClinic();
  const visits = propVisits || ctxVisits;
  const doctors = propDoctors || ctxDoctors;
  const bills = propBills || ctxBills;

  // Memoized lookup map for efficient O(1) doctor access
  const doctorMap = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);

  // Filter all visits for this patient and sort newest first
  const patientVisits = visits
    .filter((v) => v.patientId === patient.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-700" />
              <h3 className="font-bold text-base text-slate-900">
                Patient Outpatient Visit History
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {patient.name} · MRN: <strong className="font-mono text-slate-800">{patient.mrn}</strong> · {patient.age}y ({patient.sex}) · {patient.phone}
            </p>
            {patient.allergies && patient.allergies.length > 0 ? (
              <p className="text-xs text-rose-600 font-bold mt-1">
                ⚠️ Known Drug Allergies: {patient.allergies.join(', ')}
              </p>
            ) : (
              <p className="text-[11px] text-slate-400 mt-0.5">
                No known drug allergies recorded
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List of Visits */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {patientVisits.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-400 italic">
              No previous outpatient visits recorded for this patient.
            </div>
          ) : (
            patientVisits.map((v) => {
              const doc = doctorMap.get(v.doctorId);
              const visitBills = bills.filter(
                (b) => b.visitId === v.id || b.invoiceNo === v.consultationReceiptNo || b.invoiceNo === v.procedureBillId || b.invoiceNo === v.pharmacyBillId
              );

              const visitDate = new Date(v.timestamp).toLocaleDateString('en-IN', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              });

              const visitTime = new Date(v.timestamp).toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              });

              return (
                <div
                  key={v.id}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-3"
                >
                  {/* Top Visit Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-sm px-2.5 py-1 rounded bg-teal-800 text-white">
                        {v.tokenNumber}
                      </span>
                      <div>
                        <div className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                          <span>{doc?.name || 'Doctor'}</span>
                          <span className="text-slate-400 font-normal">({doc?.specialty})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 font-mono">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {visitDate}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {visitTime}
                          </span>
                        </div>
                      </div>
                    </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                      {onCopyVisit && v.caseSheet && (
                        <button
                          type="button"
                          onClick={() => onCopyVisit(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100 text-[10px] font-bold cursor-pointer"
                        >
                          <FileText className="w-3 h-3" />
                          Copy file to current consultation
                        </button>
                      )}
                      {visitBills.map((b) => (
                        <span
                          key={b.id}
                          className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                            b.status === 'voided'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 line-through'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {b.invoiceNo} (₹{b.total})
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Diagnosis */}
                  <div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">
                      Clinical Diagnosis & Impression
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-0.5">
                      {v.caseSheet?.diagnosis || v.reason || 'General Outpatient Consultation'}
                    </div>
                    {v.caseSheet?.chiefComplaint && (
                      <div className="text-[11px] text-slate-600 italic mt-0.5">
                        Chief Complaint: {v.caseSheet.chiefComplaint}
                      </div>
                    )}
                  </div>

                  {/* Medicines Given */}
                  {v.prescriptions.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Pill className="w-3 h-3 text-teal-600" />
                        <span>Medicines Prescribed / Dispensed ({v.prescriptions.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                        {v.prescriptions.map((m, i) => (
                          <div key={i} className="p-1.5 bg-white rounded border border-slate-200">
                            <div className="font-semibold text-slate-900">
                              {m.drugName} ({m.strength})
                            </div>
                            <div className="text-slate-500 text-[10px]">
                              {m.dose} · {m.frequency} x {m.duration} {m.dispensed ? '· [Dispensed]' : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Procedures Done */}
                  {v.procedureOrders.length > 0 && (
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
                        <Syringe className="w-3 h-3 text-teal-600" />
                        <span>Procedures & Injections Administered ({v.procedureOrders.length})</span>
                      </div>
                      <div className="space-y-1 text-[11px]">
                        {v.procedureOrders.map((p, i) => (
                          <div key={i} className="p-1.5 bg-white rounded border border-slate-200 flex justify-between">
                            <span className="font-semibold text-slate-900">{p.name} (Qty: {p.qty})</span>
                            <span className="text-[10px] font-bold text-emerald-700">
                              {p.nurseGiven ? `Given by ${p.nurseName || 'Nurse'}` : 'Pending / Not Given'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
};
