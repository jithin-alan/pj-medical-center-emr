import React, { useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  Settings,
  RotateCcw,
  Building,
  Phone,
  FileText,
  ShieldCheck,
  Stethoscope,
  DoorClosed,
  AlertTriangle,
  Save,
  CheckCircle2
} from 'lucide-react';

export const AdminScreen: React.FC = () => {
  const {
    settings,
    updateClinicSettings,
    resetDemoData,
    doctors,
    rooms,
    auditLogs,
    currentUser,
    showToast,
    showConfirm,
  } = useClinic();

  const [clinicName, setClinicName] = useState(settings.clinicName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [regNumber, setRegNumber] = useState(settings.regNumber);
  const [gstNote, setGstNote] = useState(settings.gstNote);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await updateClinicSettings({
      clinicName,
      address,
      phone,
      regNumber,
      gstNote,
    });
    if (success) {
      showToast('success', 'Clinic configuration updated successfully.', 'Settings Saved');
    }
  };

  const handleResetClick = () => {
    showConfirm({
      title: 'Reset Clinical & Billing Demo Data?',
      message:
        'This will reset all current outpatient tokens, visits, procedure orders, and invoices back to the default prototype dataset. In accordance with clinical governance, the immutable Audit Log will NOT be deleted.',
      confirmLabel: 'Confirm System Reset',
      danger: true,
      onConfirm: async () => {
        await resetDemoData();
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl">
            <Settings className="w-6 h-6 text-teal-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Clinic Administration & Configuration
            </h2>
            <p className="text-xs text-slate-500">
              Administrator: <strong className="text-slate-700">{currentUser.name}</strong> · Practice Metadata & System Maintenance
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-slate-500 block">System Mode</span>
          <span className="text-xs font-bold font-mono text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 inline-block">
            Prototype Demo (Kerala, IN)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Clinic Settings Form */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="pb-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900 uppercase">
              Clinic Identification & Header Details
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These details appear on thermal receipts, A5 prescription slips, and official documentation.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-teal-600" />
                <span>Clinic / Facility Name *</span>
              </label>
              <input
                type="text"
                required
                value={clinicName}
                onChange={(e) => setClinicName(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-600" />
                <span>Physical Address & Postal Code *</span>
              </label>
              <textarea
                rows={2}
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
                  <span>Contact Phone (+91) *</span>
                </label>
                <input
                  type="text"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Registration / Establishment License # *
                </label>
                <input
                  type="text"
                  required
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                GST / Tax Compliance Note (Displayed on Receipts) *
              </label>
              <input
                type="text"
                required
                value={gstNote}
                onChange={(e) => setGstNote(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Save Clinic Settings</span>
              </button>
            </div>
          </form>

          {/* Current Doctors and Rooms Overview */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase">
              Current Medical Staff & Consultation Rooms
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Registered Doctors ({doctors.length})
                </span>
                {doctors.map((d) => (
                  <div key={d.id} className="text-xs text-slate-800 flex justify-between">
                    <span>{d.name}</span>
                    <span className="font-mono text-teal-800 font-semibold">₹{d.consultationFee}</span>
                  </div>
                ))}
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">
                  Consultation Rooms ({rooms.length})
                </span>
                {rooms.map((r) => (
                  <div key={r.id} className="text-xs text-slate-800 flex justify-between">
                    <span>{r.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {r.occupiedByDoctorName ? `In use (${r.occupiedByDoctorName})` : 'Free'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Demo Reset & Audit Security */}
        <div className="lg:col-span-5 space-y-6">
          {/* Demo Reset Card */}
          <div className="bg-white rounded-xl border border-rose-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <RotateCcw className="w-5 h-5" />
              <span>Reset Demo Clinical Data</span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              In Stage 1 & 7 changes, the <strong>Reset Demo Data</strong> button was intentionally removed from normal role screens to prevent accidental data loss during clinical workflows.
            </p>

            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Audit Trail Retention Guarantee:</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Clicking reset clears created demo visits, bills, and resets drug stocks. However, the <strong>immutable audit trail log is strictly preserved</strong> and the reset itself is appended as an audited administrator event.
              </p>
            </div>

            <button
              type="button"
              onClick={handleResetClick}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Demo Clinical & Billing Data</span>
            </button>
          </div>

          {/* Audit Trail Statistics */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <ShieldCheck className="w-5 h-5 text-teal-600" />
                <span>Audit Trail Integrity</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {auditLogs.length} events logged
              </span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Every patient creation, token call, case sheet update, procedure administration, batch stock-in, and void operation is cryptographically timestamped and attributed to the active typed username.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
