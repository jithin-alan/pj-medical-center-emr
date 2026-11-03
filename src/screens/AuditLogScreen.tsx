import React, { useState, useMemo } from 'react';
import { useClinic } from '../context/ClinicContext';
import {
  ShieldCheck,
  Search,
  Filter,
  Clock,
  User,
  Calendar,
  XCircle,
  FileText
} from 'lucide-react';

export const AuditLogScreen: React.FC = () => {
  const { auditLogs } = useClinic();

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [patientMrnFilter, setPatientMrnFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Extract unique actions for filter dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(auditLogs.map((l) => l.action));
    return Array.from(set).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      // General search term
      const matchesSearch =
        !searchTerm.trim() ||
        log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.targetEntity.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.patientMrn && log.patientMrn.toLowerCase().includes(searchTerm.toLowerCase()));

      // Role filter
      const matchesRole =
        roleFilter === 'ALL' || (log.role || log.userRole || '').toUpperCase() === roleFilter.toUpperCase();

      // Action filter
      const matchesAction = actionFilter === 'ALL' || log.action === actionFilter;

      // Patient MRN filter
      const matchesMrn =
        !patientMrnFilter.trim() ||
        (log.patientMrn && log.patientMrn.toLowerCase().includes(patientMrnFilter.toLowerCase().trim()));

      // Date filter
      const matchesDate =
        !dateFilter ||
        log.timestamp.startsWith(dateFilter);

      return matchesSearch && matchesRole && matchesAction && matchesMrn && matchesDate;
    });
  }, [auditLogs, searchTerm, roleFilter, actionFilter, patientMrnFilter, dateFilter]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setRoleFilter('ALL');
    setActionFilter('ALL');
    setPatientMrnFilter('');
    setDateFilter('');
  };

  const hasActiveFilters =
    Boolean(searchTerm) ||
    roleFilter !== 'ALL' ||
    actionFilter !== 'ALL' ||
    Boolean(patientMrnFilter) ||
    Boolean(dateFilter);

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Clinical, Financial & System Audit Trail
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, append-only security log. Records every clinical entry, procedure administration, stock change, and financial void.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            {filteredLogs.length} of {auditLogs.length} Entries
          </span>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded cursor-pointer"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Criteria Filter Bar (Stage 7 Requirement: Date, Role, Action, Patient MRN) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
        {/* Search */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Keywords</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search details..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden text-xs"
            />
          </div>
        </div>

        {/* Patient MRN */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Patient MR Number</label>
          <input
            type="text"
            placeholder="e.g. PJ-000001"
            value={patientMrnFilter}
            onChange={(e) => setPatientMrnFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:outline-hidden font-mono uppercase text-xs"
          />
        </div>

        {/* Role Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">User Role</label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-xs"
          >
            <option value="ALL">All Roles</option>
            <option value="RECEPTIONIST">Receptionist</option>
            <option value="DOCTOR">Doctor</option>
            <option value="NURSE">Nurse</option>
            <option value="PHARMACIST">Pharmacist</option>
            <option value="ACCOUNTS">Accounts</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>

        {/* Action Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Action Type</label>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-medium text-xs font-mono"
          >
            <option value="ALL">All Actions ({uniqueActions.length})</option>
            {uniqueActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {/* Date Filter */}
        <div>
          <label className="block text-[11px] font-bold text-slate-600 mb-1">Date</label>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-700 text-xs font-mono"
          />
        </div>
      </div>

      {/* Log Feed */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-xs text-slate-400 italic">
            No audit logs matched your search filters.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const dateStr = new Date(log.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            });
            const timeStr = new Date(log.timestamp).toLocaleTimeString('en-IN', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            });

            return (
              <div
                key={log.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2 text-xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-800 text-white tracking-wider">
                      {log.action}
                    </span>
                    <span className="font-bold text-slate-900 text-sm">{log.targetEntity}</span>
                    {log.patientMrn && (
                      <span className="font-mono font-bold text-[10px] bg-teal-100 text-teal-800 px-2 py-0.5 rounded border border-teal-200">
                        {log.patientMrn}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-slate-500 font-mono text-[11px]">
                    <Clock className="w-3.5 h-3.5" />
                    <span>
                      {dateStr} · {timeStr}
                    </span>
                  </div>
                </div>

                <p className="text-slate-700 leading-relaxed font-sans">{log.details}</p>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-slate-400" />
                    <span>
                      Actor: <strong className="text-slate-700">{log.userName}</strong> ({log.role || log.userRole})
                    </span>
                  </div>

                  {(log.beforeValue || log.afterValue) && (
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                      {log.beforeValue?.status && log.afterValue?.status ? (
                        <span className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-bold flex items-center gap-1">
                          <span>Status:</span>
                          <span className="text-amber-800">{log.beforeValue.status}</span>
                          <span>→</span>
                          <span className={log.afterValue.status === 'GIVEN' ? 'text-teal-800' : 'text-emerald-800'}>
                            {log.afterValue.status}
                          </span>
                          {log.afterValue.billInvoiceNo && (
                            <span className="text-slate-500 font-normal">({log.afterValue.billInvoiceNo})</span>
                          )}
                        </span>
                      ) : log.afterValue?.status ? (
                        <span className="px-2 py-0.5 rounded bg-white text-slate-800 border border-slate-300 font-bold flex items-center gap-1">
                          <span>Status:</span>
                          <span className="text-amber-800">{log.afterValue.status}</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          State Transition Captured
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
