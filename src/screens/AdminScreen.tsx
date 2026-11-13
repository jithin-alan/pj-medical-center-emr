import React, { useEffect, useState } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  Settings,
  RotateCcw,
  Activity,
  UsersRound,
  ReceiptText,
  Building,
  Phone,
  FileText,
  ShieldCheck,
  Stethoscope,
  DoorClosed,
  AlertTriangle,
  Save,
  CheckCircle2,
  UserPlus,
  Users,
  Mail,
  UserX,
  BadgePercent
} from 'lucide-react';
import { Doctor, Role, ShiftType, StaffAccount } from '../types';

export const AdminScreen: React.FC = () => {
  const {
    settings,
    patients,
    bills,
    visits,
    updatePatientDiscount,
    updateClinicSettings,
    resetDemoData,
    doctors,
    rooms,
    auditLogs,
    staffAccounts,
    saveStaffAccount,
    deleteStaffAccount,
    updateDoctorSchedule,
    currentUser,
    showToast,
    showConfirm,
  } = useClinic();

  const [clinicName, setClinicName] = useState(settings.clinicName);
  const [address, setAddress] = useState(settings.address);
  const [phone, setPhone] = useState(settings.phone);
  const [regNumber, setRegNumber] = useState(settings.regNumber);
  const [gstNote, setGstNote] = useState(settings.gstNote);
  const [staffForm, setStaffForm] = useState({ id: '', name: '', email: '', phone: '', role: 'receptionist' as Role, modules: ['receptionist'] as Role[], shift: 'Shift A' as ShiftType, active: true });
  const [doctorSchedules, setDoctorSchedules] = useState<Record<string, Partial<Doctor>>>({});
  const [discountForm, setDiscountForm] = useState({ patientId: '', type: 'percentage' as 'percentage' | 'fixed', value: '', reason: '' });
  useEffect(() => {
    setDoctorSchedules(Object.fromEntries(doctors.map((doctor) => [doctor.id, { shift: doctor.shift || 'Shift A', startTime: doctor.startTime || '08:00', endTime: doctor.endTime || '14:00', roomId: doctor.roomId, workingDays: doctor.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }])));
  }, [doctors]);

  const getScheduleConflict = (doctorId: string, schedule: Partial<Doctor>): string | null => {
    if (!schedule.startTime || !schedule.endTime || schedule.startTime >= schedule.endTime) {
      return 'End time must be later than start time.';
    }
    if (!schedule.roomId) return null;
    const sharedDays = schedule.workingDays || [];
    const conflict = doctors.find((other) => {
      if (other.id === doctorId || other.roomId !== schedule.roomId) return false;
      const otherDays = other.workingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const sharesDay = sharedDays.some((day) => otherDays.includes(day));
      return sharesDay && schedule.startTime! < (other.endTime || '14:00') && (other.startTime || '08:00') < schedule.endTime!;
    });
    if (!conflict) return null;
    const roomName = rooms.find((room) => room.id === schedule.roomId)?.name || 'Selected room';
    return `${roomName} overlaps ${conflict.name}'s schedule (${conflict.startTime || '08:00'}–${conflict.endTime || '14:00'}) on a shared working day.`;
  };

  const staffRoles: { value: Role; label: string }[] = [
    { value: 'receptionist', label: 'Reception' }, { value: 'doctor', label: 'Doctor' },
    { value: 'nurse', label: 'Nursing' }, { value: 'pharmacist', label: 'Pharmacy' },
    { value: 'laboratory', label: 'Laboratory' }, { value: 'accounts', label: 'Accounts' },
    { value: 'audit', label: 'Audit / Compliance' }, { value: 'admin', label: 'Administrator' },
  ];

  const startEditStaff = (staff: StaffAccount) => setStaffForm({ id: staff.id, name: staff.name, email: staff.email, phone: staff.phone, role: staff.role, modules: staff.modules, shift: staff.shift || 'Shift A', active: staff.active });
  const toggleModule = (module: Role) => setStaffForm((form) => ({ ...form, modules: form.modules.includes(module) ? form.modules.filter((item) => item !== module) : [...form.modules, module] }));
  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      showToast('error', 'Staff name and email are required.');
      return;
    }
    const ok = await saveStaffAccount({ ...staffForm, modules: staffForm.modules.length ? staffForm.modules : [staffForm.role] });
    if (ok) setStaffForm({ id: '', name: '', email: '', phone: '', role: 'receptionist', modules: ['receptionist'], shift: 'Shift A', active: true });
  };

  const handleGrantDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(discountForm.value);
    if (!discountForm.patientId || !Number.isFinite(value) || value <= 0 || (discountForm.type === 'percentage' && value > 100) || !discountForm.reason.trim()) {
      showToast('error', 'Select a patient and enter a valid discount and reason.');
      return;
    }
    if (await updatePatientDiscount(discountForm.patientId, { type: discountForm.type, value, reason: discountForm.reason.trim() })) {
      setDiscountForm({ patientId: '', type: 'percentage', value: '', reason: '' });
    }
  };

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

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Billing & patient discounts</span><span className="block text-xs font-normal text-slate-500 mt-1">Manage one-time discounts for consultation, procedure, and lab bills.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{patients.filter((patient) => patient.discount?.remainingUses).length} active discounts</span>
        </summary>
        <section className="bg-white rounded-b-xl border-t border-slate-200 p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-200">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><BadgePercent className="w-4 h-4 text-teal-600" />Patient Discounts</div>
          <p className="text-xs text-slate-500 mt-1">Grant a one-time discount for consultation, procedure, or lab billing. Pharmacy invoices are excluded.</p>
        </div>
        <form onSubmit={handleGrantDiscount} className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end text-xs">
          <label className="block font-semibold text-slate-600">Patient<select required value={discountForm.patientId} onChange={(e) => setDiscountForm({ ...discountForm, patientId: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 bg-white"><option value="">Select patient</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.name} · {patient.mrn}</option>)}</select></label>
          <label className="block font-semibold text-slate-600">Discount type<select value={discountForm.type} onChange={(e) => setDiscountForm({ ...discountForm, type: e.target.value as 'percentage' | 'fixed' })} className="mt-1 w-full border border-slate-300 rounded-lg p-2.5 bg-white"><option value="percentage">Percentage (%)</option><option value="fixed">Fixed amount (₹)</option></select></label>
          <label className="block font-semibold text-slate-600">{discountForm.type === 'percentage' ? 'Percentage (1–100)' : 'Amount (₹)'}<input required type="number" min="0.01" max={discountForm.type === 'percentage' ? 100 : undefined} step="0.01" value={discountForm.value} onChange={(e) => setDiscountForm({ ...discountForm, value: e.target.value })} className="mt-1 w-full border border-slate-300 rounded-lg p-2.5" /></label>
          <label className="block font-semibold text-slate-600">Reason<input required maxLength={200} value={discountForm.reason} onChange={(e) => setDiscountForm({ ...discountForm, reason: e.target.value })} placeholder="Reason for discount" className="mt-1 w-full border border-slate-300 rounded-lg p-2.5" /></label>
          <button className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg">Grant one-time discount</button>
        </form>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">{patients.filter((patient) => patient.discount?.remainingUses).map((patient) => <div key={patient.id} className="flex flex-wrap justify-between gap-2 p-3 text-xs"><span className="font-bold text-slate-800">{patient.name} · {patient.mrn}</span><span className="text-teal-700">{patient.discount?.type === 'percentage' ? `${patient.discount.value}%` : `₹${patient.discount?.value}`} available · {patient.discount?.reason}</span></div>)}{!patients.some((patient) => patient.discount?.remainingUses) && <p className="p-3 text-xs text-slate-500">No active patient discounts.</p>}</div>
        </section>
      </details>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Billing oversight</span><span className="block text-xs font-normal text-slate-500 mt-1">Review collected amounts, outstanding balances, and invoice status by billing area.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{bills.filter((bill) => ['draft', 'finalized', 'partially_paid'].includes(bill.status)).length} outstanding</span>
        </summary>
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 border-t border-slate-200 p-5">
          {(['consultation', 'procedure', 'lab', 'pharmacy'] as const).map((type) => {
            const groupBills = bills.filter((bill) => bill.type === type && !['voided', 'cancelled'].includes(bill.status));
            const collected = groupBills.reduce((sum, bill) => sum + (bill.amountPaid ?? (bill.status === 'paid' ? bill.total : 0)), 0);
            const outstanding = groupBills.reduce((sum, bill) => sum + (bill.balanceDue ?? (['draft', 'finalized', 'partially_paid'].includes(bill.status) ? Math.max(0, bill.total - (bill.amountPaid || 0)) : 0)), 0);
            const labels = { consultation: 'Consultation', procedure: 'Procedure', lab: 'Laboratory', pharmacy: 'Pharmacy' };
            return <div key={type} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><ReceiptText className="w-4 h-4 text-teal-700" />{labels[type]}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="block text-slate-500">Collected</span><strong className="text-teal-800">₹{collected.toFixed(2)}</strong></div><div><span className="block text-slate-500">Outstanding</span><strong className={outstanding ? 'text-orange-700' : 'text-slate-700'}>₹{outstanding.toFixed(2)}</strong></div></div>
              <div className="mt-2 border-t border-slate-200 pt-2 text-[11px] text-slate-500">{groupBills.length} active invoice{groupBills.length === 1 ? '' : 's'}</div>
            </div>;
          })}
        </section>
      </details>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Operational reporting</span><span className="block text-xs font-normal text-slate-500 mt-1">Snapshot of visit flow, invoice states, and recent billing activity.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{visits.length} visits · {bills.length} bills</span>
        </summary>
        {(() => {
          const today = new Date().toLocaleDateString('en-CA');
          const todayVisits = visits.filter((visit) => new Date(visit.timestamp).toLocaleDateString('en-CA') === today);
          const todayBills = bills.filter((bill) => new Date(bill.timestamp).toLocaleDateString('en-CA') === today);
          const paidToday = todayBills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + bill.total, 0);
          const outstanding = bills.filter((bill) => ['draft', 'finalized', 'partially_paid'].includes(bill.status)).reduce((sum, bill) => sum + (bill.balanceDue ?? Math.max(0, bill.total - (bill.amountPaid || 0))), 0);
          const completedVisits = todayVisits.filter((visit) => ['completed', 'completed_dispensed', 'completed_reported'].includes(visit.status)).length;
          const inProgressVisits = todayVisits.length - completedVisits;
          const recentBills = [...todayBills].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5);
          const currency = (amount: number) => `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
          return <section className="border-t border-slate-200 p-5 space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><UsersRound className="w-4 h-4 text-blue-600" />Today's visits</div><div className="mt-2 text-2xl font-black text-slate-900">{todayVisits.length}</div><div className="text-[11px] text-slate-500">{completedVisits} completed · {inProgressVisits} in progress</div></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><ReceiptText className="w-4 h-4 text-teal-700" />Bills today</div><div className="mt-2 text-2xl font-black text-slate-900">{todayBills.length}</div><div className="text-[11px] text-slate-500">{todayBills.filter((bill) => bill.status === 'paid').length} paid · {todayBills.filter((bill) => ['draft', 'finalized', 'partially_paid'].includes(bill.status)).length} awaiting payment</div></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Collected today</div><div className="mt-2 text-2xl font-black text-teal-800">{currency(paidToday)}</div><div className="text-[11px] text-slate-500">Paid invoices only</div></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4"><div className="text-xs font-semibold text-slate-500">Outstanding balances</div><div className="mt-2 text-2xl font-black text-orange-700">{currency(outstanding)}</div><div className="text-[11px] text-slate-500">Across active invoices</div></div>
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-800"><Activity className="w-4 h-4 text-teal-700" />Recent bills today</div>
              {recentBills.length ? <table className="w-full text-left text-xs"><thead className="bg-white text-slate-500"><tr><th className="px-4 py-2">Invoice</th><th className="px-4 py-2">Patient</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Status</th><th className="px-4 py-2 text-right">Total</th></tr></thead><tbody className="divide-y divide-slate-100">{recentBills.map((bill) => <tr key={bill.id}><td className="px-4 py-2 font-mono">{bill.invoiceNo}</td><td className="px-4 py-2">{bill.patientName}</td><td className="px-4 py-2 capitalize">{bill.type}</td><td className="px-4 py-2 capitalize">{bill.status.replaceAll('_', ' ')}</td><td className="px-4 py-2 text-right">{currency(bill.total)}</td></tr>)}</tbody></table> : <p className="px-4 py-5 text-center text-xs text-slate-500">No bills recorded today.</p>}
            </div>
          </section>;
        })()}
      </details>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Staff & access</span><span className="block text-xs font-normal text-slate-500 mt-1">Manage staff accounts, roles, shifts, and permitted work areas.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{staffAccounts.filter((staff) => staff.active).length} active staff</span>
        </summary>
      <div className="bg-white rounded-b-xl border-t border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200">
          <div><div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Users className="w-4 h-4 text-teal-600" />Staff Accounts & Role Permissions</div><p className="text-xs text-slate-500 mt-1">Create staff identities and limit each account to approved work areas.</p></div>
          <span className="text-xs font-bold bg-slate-100 px-3 py-1 rounded-full">{staffAccounts.filter((staff) => staff.active).length} active</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form onSubmit={handleSaveStaff} className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 text-xs">
            <div className="font-bold text-slate-800 flex items-center gap-2">{staffForm.id ? <ShieldCheck className="w-4 h-4 text-teal-600" /> : <UserPlus className="w-4 h-4 text-teal-600" />}{staffForm.id ? 'Edit Staff Account' : 'Add Staff Account'}</div>
            <input required placeholder="Full name" value={staffForm.name} onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5" />
            <input required type="email" placeholder="Email address" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5" />
            <input placeholder="Phone number" value={staffForm.phone} onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2.5" />
            <select value={staffForm.shift} onChange={(e) => setStaffForm({ ...staffForm, shift: e.target.value as ShiftType })} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white"><option value="Shift A">Shift A</option><option value="Shift B">Shift B</option><option value="Shift C">Shift C</option></select>
            <select value={staffForm.role} onChange={(e) => { const role = e.target.value as Role; setStaffForm({ ...staffForm, role, modules: [role] }); }} className="w-full border border-slate-300 rounded-lg p-2.5 bg-white">
              {staffRoles.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <div><div className="font-bold text-slate-600 mb-2">Additional accessible modules</div><div className="grid grid-cols-2 gap-2">
              {staffRoles.filter((item) => item.value !== staffForm.role).map((item) => <label key={item.value} className="flex items-center gap-1.5"><input type="checkbox" checked={staffForm.modules.includes(item.value)} onChange={() => toggleModule(item.value)} />{item.label}</label>)}
            </div></div>
            {staffForm.id && <label className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg p-2.5 bg-white"><span className="font-bold text-slate-700">Account active</span><input type="checkbox" checked={staffForm.active} onChange={(e) => setStaffForm({ ...staffForm, active: e.target.checked })} className="w-4 h-4 accent-teal-600" /></label>}
            <div className="flex gap-2"><button className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-lg">{staffForm.id ? 'Save Changes' : 'Create Account'}</button>{staffForm.id && <button type="button" onClick={() => setStaffForm({ id: '', name: '', email: '', phone: '', role: 'receptionist', modules: ['receptionist'], shift: 'Shift A', active: true })} className="px-3 bg-slate-200 rounded-lg">Cancel</button>}</div>
          </form>
          <div className="lg:col-span-2 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
            {staffAccounts.map((staff) => <div key={staff.id} className={`flex items-center justify-between gap-3 p-3 text-xs ${staff.active ? 'bg-white' : 'bg-slate-100 opacity-60'}`}><div><div className="font-bold text-slate-900">{staff.name} {!staff.active && <span className="text-rose-600">(Inactive)</span>}</div><div className="text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{staff.email}</div><div className="text-[10px] text-teal-700 mt-1">{staff.role} · {staff.shift || 'Shift A'} · {staff.modules.join(', ')}</div></div><div className="flex gap-2"><button onClick={() => startEditStaff(staff)} className="px-2.5 py-1.5 border border-slate-300 rounded-lg">Edit</button>{staff.role !== 'admin' && <button onClick={() => saveStaffAccount({ ...staff, active: !staff.active })} title={staff.active ? 'Deactivate account' : 'Activate account'} className={`p-1.5 border rounded-lg ${staff.active ? 'text-rose-600 border-rose-200 hover:bg-rose-50' : 'text-emerald-600 border-emerald-200 hover:bg-emerald-50'}`}>{staff.active ? <UserX className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}</button>}</div></div>)}
          </div>
        </div>
      </div>
      </details>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Doctors & rooms</span><span className="block text-xs font-normal text-slate-500 mt-1">Set working days, shift times, and consultation room assignments.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{doctors.length} doctors · {rooms.length} rooms</span>
        </summary>
      <div className="bg-white rounded-b-xl border-t border-slate-200 p-6 shadow-xs space-y-4">
        <div className="pb-3 border-b border-slate-200"><div className="flex items-center gap-2 text-sm font-bold text-slate-900"><Stethoscope className="w-4 h-4 text-teal-600" />Doctor Schedules & Room Assignment</div><p className="text-xs text-slate-500 mt-1">PJ Medical Center has 2 OP rooms. A room can be shared by doctors scheduled at different, non-overlapping times on their working days.</p></div>
        <div className="space-y-3">
          {doctors.map((doctor) => {
            const schedule = doctorSchedules[doctor.id] || {};
            const days = schedule.workingDays || [];
            const update = (patch: Partial<Doctor>) => setDoctorSchedules((current) => ({ ...current, [doctor.id]: { ...current[doctor.id], ...patch } }));
            return <div key={doctor.id} className="grid grid-cols-1 xl:grid-cols-[1.4fr_0.7fr_0.7fr_0.7fr_1fr_auto] gap-3 items-end p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div><div className="font-bold text-slate-900">{doctor.name}</div><div className="text-[10px] text-slate-500">{doctor.specialty}</div></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">Shift</label><select value={schedule.shift || 'Shift A'} onChange={(e) => update({ shift: e.target.value as ShiftType })} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option>Shift A</option><option>Shift B</option><option>Shift C</option></select></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">Start</label><input type="time" value={schedule.startTime || '08:00'} onChange={(e) => update({ startTime: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 bg-white" /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">End</label><input type="time" value={schedule.endTime || '14:00'} onChange={(e) => update({ endTime: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 bg-white" /></div>
              <div><label className="block text-[10px] font-bold text-slate-500 mb-1">Room</label><select value={schedule.roomId || ''} onChange={(e) => update({ roomId: e.target.value })} className="w-full border border-slate-300 rounded-lg p-2 bg-white"><option value="">Unassigned</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></div>
              <button disabled={Boolean(getScheduleConflict(doctor.id, schedule))} onClick={() => updateDoctorSchedule(doctor.id, schedule)} className="px-3 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-lg">Save</button>
              {getScheduleConflict(doctor.id, schedule) && <div role="alert" className="xl:col-span-6 p-2.5 rounded-lg border border-orange-200 bg-orange-50 text-orange-800 font-medium">{getScheduleConflict(doctor.id, schedule)}</div>}
              <div className="xl:col-span-5 flex gap-2 flex-wrap"><span className="text-[10px] font-bold text-slate-500">Days:</span>{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day) => <label key={day} className="flex items-center gap-1"><input type="checkbox" checked={days.includes(day)} onChange={(e) => update({ workingDays: e.target.checked ? [...days, day] : days.filter((item) => item !== day) })} />{day}</label>)}</div>
            </div>;
          })}
          {doctors.length === 0 && <div className="text-xs text-slate-400 py-5 text-center">Loading doctor schedules...</div>}
        </div>
      </div>
      </details>

      <details className="group rounded-xl border border-slate-200 bg-white shadow-xs">
        <summary className="cursor-pointer list-none p-4 text-slate-900 flex items-center justify-between gap-4">
          <span><span className="block font-bold">Clinic profile & system</span><span className="block text-xs font-normal text-slate-500 mt-1">Update clinic identity and receipt details, review audit status, or manage demo data.</span></span>
          <span className="shrink-0 text-xs font-semibold text-teal-700">{auditLogs.length} audit events</span>
        </summary>
      <div className="border-t border-slate-200 p-4">
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
                    <span className="text-[10px] text-slate-500 text-right">
                      {doctors.filter((doctor) => doctor.roomId === r.id).length > 0
                        ? doctors.filter((doctor) => doctor.roomId === r.id).map((doctor) => `${doctor.name} (${doctor.startTime}-${doctor.endTime})`).join(' · ')
                        : r.occupiedByDoctorName ? `In use (${r.occupiedByDoctorName})` : 'Free'}
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
      </details>
    </div>
  );
};
