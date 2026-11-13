import React, { useState, useMemo } from 'react';
import { useClinic } from '../context/ClinicContext';
import { Role } from '../types';
import {
  Stethoscope,
  User,
  Shield,
  Users,
  Syringe,
  Pill,
  FlaskConical,
  Calculator,
  Tv,
} from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { role, setRole, userName, setUserName, staffAccounts, fallbackStaffAccounts, login, logout } = useClinic();

  // Use fallback accounts if server data not loaded yet
  const accounts = staffAccounts.length > 0 ? staffAccounts : fallbackStaffAccounts;

  // Roles that have staff accounts (can select from existing users)
  const staffRoles: Role[] = ['receptionist', 'doctor', 'nurse', 'pharmacist', 'laboratory', 'accounts', 'admin', 'audit'];

  // Role dropdown options
  const roleOptions = [
    { value: 'receptionist' as Role, label: 'Reception', icon: <Users className="w-4 h-4" /> },
    { value: 'doctor' as Role, label: 'Doctor', icon: <Stethoscope className="w-4 h-4" /> },
    { value: 'nurse' as Role, label: 'Nurse', icon: <Syringe className="w-4 h-4" /> },
    { value: 'pharmacist' as Role, label: 'Pharmacy', icon: <Pill className="w-4 h-4" /> },
    { value: 'laboratory' as Role, label: 'Laboratory', icon: <FlaskConical className="w-4 h-4" /> },
    { value: 'accounts' as Role, label: 'Accounts', icon: <Calculator className="w-4 h-4" /> },
    { value: 'admin' as Role, label: 'Admin', icon: <Shield className="w-4 h-4" /> },
    { value: 'audit' as Role, label: 'Audit', icon: <Shield className="w-4 h-4" /> },
    { value: 'tv' as Role, label: 'TV Display', icon: <Tv className="w-4 h-4" /> },
  ];

  // Users available for the selected role
  const availableUsers = useMemo(() => {
    return accounts.filter((s) => s.role === role && s.active);
  }, [role, accounts]);

  const [selectedUsername, setSelectedUsername] = useState<string>('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    const matchedStaff = accounts.find(
      (s) => s.name.toLowerCase() === selectedUsername.toLowerCase() && s.role === role
    );
    if (matchedStaff) {
      login(matchedStaff);
    }
  };

  const handleAutoLogin = () => {
    if (availableUsers.length > 0) {
      login(availableUsers[0]);
    }
  };

  // Check if user is trying to log in with an account that doesn't exist for this role
  const userExistsForRole = accounts.some((s) => s.name.toLowerCase() === selectedUsername.toLowerCase() && s.role === role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-6 border border-slate-200">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
            <Stethoscope className="w-8 h-8 text-teal-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">PJ Medical Center</h1>
          <p className="text-xs text-slate-500">Clinic Management System</p>
        </div>

        {/* Login Form */}
        <form onSubmit={(e) => { e.preventDefault(); if (userExistsForRole || selectedUsername.trim()) handleLogin(); }} className="space-y-4">
          {/* Role Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => {
                setRole(e.target.value as Role);
                setSelectedUsername('');
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-white"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.icon} {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* User Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              User Name
            </label>
            {availableUsers.length > 0 ? (
              <select
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-white"
              >
                <option value="">-- Select User --</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.name}>
                    {u.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                placeholder="Type your name"
                value={selectedUsername}
                onChange={(e) => setSelectedUsername(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-white"
              />
            )}
          </div>

          {/* Password (inactive in demo mode) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Password
            </label>
            <input
              type="password"
              placeholder="• Demo mode - password not required"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-teal-500 focus:outline-none bg-slate-50"
              disabled
            />
            <p className="text-[10px] text-slate-400 mt-0.5">Inactive in demo mode</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {availableUsers.length > 0 ? (
              <button
                type="submit"
                disabled={!selectedUsername}
                className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
              >
                Sign In
              </button>
            ) : (
              <button
                type="button"
                onClick={handleAutoLogin}
                className="flex-1 px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
              >
                Quick Start
              </button>
            )}
          </div>
        </form>

        {/* Quick Access for Staff */}
        {role !== 'tv' && (
          <div className="pt-4 border-t border-slate-100">
            <button
              onClick={handleAutoLogin}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-teal-600 rounded-lg transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              Quick Switch User
            </button>
          </div>
        )}
      </div>
    </div>
  );
};