import React, { useEffect, useState, useRef } from 'react';
import { useClinic } from '../context/ClinicContext';
import { Volume2, Maximize2, Minimize2, Tv, Clock, Sparkles } from 'lucide-react';
import { playClinicChime } from '../utils/audioChime';

export const TvDisplayScreen: React.FC = () => {
  const { visits, rooms, doctors, latestCalledToken } = useClinic();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevCalledRef = useRef<string | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Play chime whenever a new token is called
  useEffect(() => {
    if (latestCalledToken?.tokenNumber) {
      if (prevCalledRef.current && prevCalledRef.current !== latestCalledToken.tokenNumber) {
        playClinicChime();
      }
      prevCalledRef.current = latestCalledToken.tokenNumber;
    }
  }, [latestCalledToken]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Last 5 called tokens (either currently with_doctor or recently called)
  const calledVisits = visits
    .filter((v) => v.calledAt && (v.status === 'with_doctor' || v.status === 'procedure_billing_pending' || v.status === 'nurse_check_pending' || v.status === 'waiting_pharmacy' || v.status === 'completed'))
    .sort((a, b) => new Date(b.calledAt || 0).getTime() - new Date(a.calledAt || 0).getTime())
    .slice(0, 5);

  // Waiting list - TOKENS ONLY! (Strict requirement: Never show patient names!)
  const waitingVisits = visits
    .filter((v) => v.status === 'waiting_doctor')
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top TV Bar */}
      <header className="px-8 py-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-teal-600 rounded-xl shadow-lg shadow-teal-500/20">
            <Tv className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-wide text-white uppercase flex items-center gap-2">
              <span>PJ MEDICAL CLINIC</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-normal">
                WAITING ROOM DISPLAY
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Token Number & Room Status Only · Confidential Patient Calling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Real-time Clock */}
          <div className="text-right">
            <div className="text-2xl lg:text-3xl font-bold font-mono text-teal-400">
              {currentTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {currentTime.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => playClinicChime()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition-colors"
              title="Test hospital chime audio"
            >
              <Volume2 className="w-4 h-4 text-teal-400" />
              <span>Chime</span>
            </button>
            <button
              onClick={toggleFullscreen}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg text-slate-200 transition-colors"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span>{isFullscreen ? 'Exit' : 'Full'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main TV Screen Content */}
      <main className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-[1600px] w-full mx-auto items-stretch">
        {/* Left Column: Currently Active Calling Rooms (Last 5 Called) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xl font-bold text-slate-200 tracking-wider uppercase flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-400" />
              <span>NOW CALLING / ACTIVE CONSULTATIONS</span>
            </h2>
            <span className="text-xs text-slate-400">Tokens assigned to Room 1 & Room 2</span>
          </div>

          {/* Current Room Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rooms.map((room) => {
              const activeDoc = doctors.find((d) => d.id === room.occupiedByDoctorId);

              return (
                <div
                  key={room.id}
                  className={`rounded-2xl border-2 p-6 flex flex-col justify-between transition-all duration-300 ${
                    room.currentTokenNumber
                      ? 'bg-gradient-to-br from-slate-900 to-slate-850 border-teal-500 shadow-xl shadow-teal-500/10 ring-1 ring-teal-500/30'
                      : 'bg-slate-900/50 border-slate-800 text-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <span className="text-xl font-black text-slate-300 tracking-wider">
                      {room.name.toUpperCase()}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        room.currentTokenNumber
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {room.currentTokenNumber ? 'IN PROGRESS' : 'VACANT'}
                    </span>
                  </div>

                  {/* Token Big Display */}
                  <div className="py-6 text-center">
                    {room.currentTokenNumber ? (
                      <div className="space-y-1">
                        <div className="text-xs uppercase tracking-widest text-teal-400 font-semibold">
                          TOKEN NUMBER
                        </div>
                        <div className="text-6xl md:text-7xl font-black font-mono tracking-widest text-white drop-shadow-md">
                          {room.currentTokenNumber}
                        </div>
                      </div>
                    ) : (
                      <div className="text-4xl font-extrabold text-slate-700 font-mono py-4">
                        --
                      </div>
                    )}
                  </div>

                  {/* Doctor Info */}
                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-sm">
                    <div>
                      <span className="text-xs text-slate-400 block">Consulting Doctor</span>
                      <span className="font-bold text-slate-200 text-base">
                        {activeDoc ? activeDoc.name : 'Waiting for doctor call'}
                      </span>
                    </div>
                    {room.occupiedAt && (
                      <div className="text-right text-xs text-slate-400 font-mono">
                        Since {new Date(room.occupiedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Last 5 Called Log (Tokens & Rooms ONLY, STRICTLY NO PATIENT NAMES) */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex-1 flex flex-col">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 pb-2 border-b border-slate-800">
              RECENTLY CALLED TOKENS (LAST 5)
            </h3>

            {calledVisits.length === 0 ? (
              <div className="text-slate-500 text-sm italic py-8 text-center flex-1 flex items-center justify-center">
                No tokens called yet today
              </div>
            ) : (
              <div className="space-y-2 flex-1">
                {calledVisits.map((v, i) => {
                  const doc = doctors.find((d) => d.id === v.doctorId);
                  const isLatest = i === 0;

                  return (
                    <div
                      key={v.id}
                      className={`flex items-center justify-between px-5 py-3.5 rounded-xl border transition-all ${
                        isLatest
                          ? 'bg-teal-950/40 border-teal-500/40 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-mono text-slate-400 w-5">#{i + 1}</span>
                        <span className="text-2xl font-black font-mono tracking-wider text-teal-300">
                          {v.tokenNumber}
                        </span>
                      </div>

                      <div className="flex items-center gap-8">
                        <div className="text-sm">
                          <span className="text-xs text-slate-400 block">Doctor</span>
                          <span className="font-semibold">{doc?.name || 'Doctor'}</span>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <span className="text-xs text-slate-400 block">Location</span>
                          <span className="font-bold text-teal-400 font-mono text-base">
                            {v.assignedRoom || 'Room 1'}
                          </span>
                        </div>
                        {v.calledAt && (
                          <span className="text-xs text-slate-500 font-mono">
                            {new Date(v.calledAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Waiting Queue (TOKENS ONLY, STRICTLY NO PATIENT NAMES) */}
        <section className="lg:col-span-4 bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col">
          <div className="border-b border-slate-800 pb-3 mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-200 tracking-wider uppercase flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>WAITING TOKENS</span>
            </h2>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {waitingVisits.length} Waiting
            </span>
          </div>

          <p className="text-xs text-slate-400 mb-4">
            Next in turn. Tokens will be called in order of arrival.
          </p>

          {waitingVisits.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 text-sm italic py-12">
              <span>All patient tokens have been served.</span>
              <span className="text-xs text-slate-600 mt-1">Waiting room queue is clear.</span>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {waitingVisits.map((v, idx) => {
                const doc = doctors.find((d) => d.id === v.doctorId);

                return (
                  <div
                    key={v.id}
                    className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-750 flex items-center justify-between hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-slate-500 w-4">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="text-xl font-black font-mono tracking-wider text-amber-300">
                          {v.tokenNumber}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {doc?.name || 'Doctor'}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-mono text-slate-400 block">
                        Registered:
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {new Date(v.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Privacy Notice Banner */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-center text-[11px] text-slate-500">
            🔒 Patient Privacy Standard: Patient names are never displayed on public waiting screens.
          </div>
        </section>
      </main>

      {/* Persistent Bottom Demo Banner */}
      <footer className="px-8 py-2.5 bg-slate-900 border-t border-slate-800 text-center text-xs text-amber-400 font-medium">
        Demo only - not for real patient data · PJ Medical Outpatient Clinic Prototype
      </footer>
    </div>
  );
};
