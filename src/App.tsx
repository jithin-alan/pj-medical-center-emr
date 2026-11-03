import React, { useState, useEffect } from 'react';
import { ClinicProvider, useClinic } from './context/ClinicContext';
import { ReceptionScreen } from './screens/ReceptionScreen';
import { DoctorScreen } from './screens/DoctorScreen';
import { NurseScreen } from './screens/NurseScreen';
import { PharmacyScreen } from './screens/PharmacyScreen';
import { LabScreen } from './screens/LabScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { AdminScreen } from './screens/AdminScreen';
import { TvDisplayScreen } from './screens/TvDisplayScreen';
import { AuditLogScreen } from './screens/AuditLogScreen';
import { ThermalReceiptModal } from './components/ThermalReceiptModal';
import { PrescriptionPrintModal } from './components/PrescriptionPrintModal';
import { VisitHistoryModal } from './components/VisitHistoryModal';
import {
  Tv,
  Stethoscope,
  Users,
  Syringe,
  Pill,
  FlaskConical,
  Calculator,
  ShieldCheck,
  AlertTriangle,
  Menu,
  X,
  Settings,
  User,
  Edit2
} from 'lucide-react';
import { Role } from './types';

const ClinicAppContent: React.FC = () => {
  const {
    role,
    setRole,
    userName,
    setUserName,
    activeReceiptBill,
    setActiveReceiptBill,
    activePrescriptionPrintVisit,
    setActivePrescriptionPrintVisit,
    activeHistoryPatient,
    setActiveHistoryPatient,
    auditLogs,
    settings,
    isConnected,
  } = useClinic();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userEditModalOpen, setUserEditModalOpen] = useState(false);
  const [tempUserName, setTempUserName] = useState(userName);

  // Check URL path or hash for TV screen
  useEffect(() => {
    if (window.location.pathname.includes('/tv') || window.location.hash === '#tv') {
      setRole('tv');
    }
  }, [setRole]);

  // Keep tempUserName synced when userName changes
  useEffect(() => {
    setTempUserName(userName);
  }, [userName]);

  // If in TV display mode, render dedicated TV screen
  if (role === 'tv') {
    return (
      <div>
        <div className="fixed top-3 right-3 z-50">
          <button
            onClick={() => {
              window.location.hash = '';
              setRole('receptionist');
            }}
            className="px-3.5 py-1.5 bg-slate-900/80 hover:bg-slate-900 text-white font-bold text-xs rounded-lg border border-slate-700 backdrop-blur-md shadow-md transition-all cursor-pointer"
          >
            ← Exit TV Mode
          </button>
        </div>
        <TvDisplayScreen />
      </div>
    );
  }

  const navItems: { role: Role | 'audit'; label: string; icon: React.ReactNode }[] = [
    { role: 'receptionist', label: 'Reception', icon: <Users className="w-4 h-4" /> },
    { role: 'doctor', label: 'Doctor', icon: <Stethoscope className="w-4 h-4" /> },
    { role: 'nurse', label: 'Nurse', icon: <Syringe className="w-4 h-4" /> },
    { role: 'pharmacist', label: 'Pharmacy', icon: <Pill className="w-4 h-4" /> },
    { role: 'laboratory', label: 'Laboratory', icon: <FlaskConical className="w-4 h-4" /> },
    { role: 'accounts', label: 'Accounts', icon: <Calculator className="w-4 h-4" /> },
    { role: 'admin', label: 'Admin', icon: <Settings className="w-4 h-4" /> },
    { role: 'tv', label: 'TV Display', icon: <Tv className="w-4 h-4" /> },
  ];

  const handleSaveUserName = (e: React.FormEvent) => {
    e.preventDefault();
    if (tempUserName.trim()) {
      setUserName(tempUserName.trim());
      setUserEditModalOpen(false);
    }
  };

  return (
    <div className={`${role === 'pharmacist' ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-slate-100/70 flex flex-col font-sans`}>
      {/* MANDATORY PERSISTENT DEMO BANNER (Stage 1: Reset button moved exclusively to Admin page) */}
      <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-center text-xs font-bold tracking-wide flex items-center justify-center gap-2 select-none shadow-xs">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span>Demo only - not for real patient data · PJ Medical Outpatient Clinic Prototype (Kerala, India)</span>
      </div>
      {!isConnected && (
        <div className="bg-orange-600 text-white px-4 py-2 text-center text-xs font-bold" role="status">
          Offline mode — cached clinic data is available. Changes will sync when the server is reachable.
        </div>
      )}

      {/* Main Clinic Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Clinic Brand Lockup */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black text-lg shadow-sm">
              PJ
            </div>
            <div>
              <h1 className="text-base font-extrabold tracking-tight text-slate-900 leading-tight">
                {settings.clinicName.replace('[Placeholder]', '').trim()}
              </h1>
              <p className="text-[11px] text-slate-500 font-medium">
                Thiruvalla, Kerala · Outpatient EMR & Billing
              </p>
            </div>
          </div>

          {/* Desktop Role Navigation Switcher (Large, Touch-Friendly Buttons) */}
          <nav className="hidden lg:flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
            {navItems.map((item) => (
              <button
                key={item.role}
                onClick={() => setRole(item.role as Role)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  role === item.role
                    ? 'bg-white text-teal-800 shadow-xs ring-1 ring-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Action Area: User Identity Badge & Audit Log Shortcut */}
          <div className="flex items-center gap-2">
            {/* Typed User Name Chip (Stage 1 requirement: logs active typed username in audit trail) */}
            <button
              onClick={() => setUserEditModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-700 transition-colors cursor-pointer group"
              title="Click to change your typed user name for audit logs"
            >
              <User className="w-3.5 h-3.5 text-teal-600" />
              <span className="font-semibold max-w-[120px] truncate">{userName}</span>
              <Edit2 className="w-3 h-3 text-slate-400 group-hover:text-slate-600" />
            </button>

            {/* Audit Log Shortcut Button */}
            <button
              onClick={() => setRole('audit' as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                (role as string) === 'audit'
                  ? 'bg-teal-50 text-teal-800 border-teal-300 font-bold'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
              title="View immutable audit log"
            >
              <ShieldCheck className="w-4 h-4 text-teal-600" />
              <span className="hidden sm:inline">Audit Log</span>
              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                {auditLogs.length}
              </span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.role}
                onClick={() => {
                  setRole(item.role as Role);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold rounded-lg ${
                  role === item.role
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setRole('audit' as any);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-bold rounded-lg ${
                (role as string) === 'audit'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Audit Trail Logs ({auditLogs.length})</span>
            </button>
          </div>
        )}
      </header>

      {/* Main Content Viewport */}
      <main className={role === 'pharmacist'
        ? 'flex-1 min-h-0 w-full overflow-hidden px-3 py-3'
        : 'flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8'}>
        {role === 'receptionist' && <ReceptionScreen />}
        {role === 'doctor' && <DoctorScreen />}
        {role === 'nurse' && <NurseScreen />}
        {role === 'pharmacist' && <PharmacyScreen />}
        {role === 'laboratory' && <LabScreen />}
        {role === 'accounts' && <AccountsScreen />}
        {role === 'admin' && <AdminScreen />}
        {(role as string) === 'audit' && <AuditLogScreen />}
      </main>

      {/* User Name Change Modal */}
      {userEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full border border-slate-200 p-5 space-y-4">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm pb-2 border-b border-slate-100">
              <User className="w-4 h-4 text-teal-600" />
              <span>Switch Active Staff Name</span>
            </div>

            <p className="text-xs text-slate-500">
              In accordance with Stage 1 architecture, this typed name is appended to every clinical and financial audit record without password gating.
            </p>

            <form onSubmit={handleSaveUserName} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Your Typed Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={tempUserName}
                  onChange={(e) => setTempUserName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserEditModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs cursor-pointer"
                >
                  Set Name
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Thermal Receipt Modal (80mm) */}
      {activeReceiptBill && (
        <ThermalReceiptModal
          bill={activeReceiptBill}
          onClose={() => setActiveReceiptBill(null)}
        />
      )}

      {/* A5 Prescription Print Modal (148mm × 210mm) */}
      {activePrescriptionPrintVisit && (
        <PrescriptionPrintModal
          visit={activePrescriptionPrintVisit}
          onClose={() => setActivePrescriptionPrintVisit(null)}
        />
      )}

      {/* Patient Visit History Modal */}
      {activeHistoryPatient && (
        <VisitHistoryModal
          patient={activeHistoryPatient}
          onClose={() => setActiveHistoryPatient(null)}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <ClinicProvider>
      <ClinicAppContent />
    </ClinicProvider>
  );
}
