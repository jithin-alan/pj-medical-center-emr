import React, { useState } from 'react';
import { PatientStage, TokenVisit } from '../types';
import {
  CheckCircle2,
  Clock,
  User,
  History,
  X
} from 'lucide-react';

export const STAGES_ORDER: { key: PatientStage; label: string; short: string; number: number }[] = [
  { key: 'registered_token_paid', label: '1. Registered + Token Paid', short: 'Token Paid', number: 1 },
  { key: 'waiting_doctor', label: '2. Waiting for Doctor', short: 'In Queue', number: 2 },
  { key: 'with_doctor', label: '3. With Doctor', short: 'Doctor', number: 3 },
  { key: 'procedure_billing_pending', label: '4. Procedure Billing Pending', short: 'Proc Billing', number: 4 },
  { key: 'nurse_check_pending', label: '5. Nurse Check Pending', short: 'Nurse Check', number: 5 },
  { key: 'procedures_done', label: '6. Procedures Done', short: 'Proc Done', number: 6 },
  { key: 'waiting_pharmacy', label: '7. Waiting for Pharmacy', short: 'Pharmacy', number: 7 },
  { key: 'completed', label: '8. Completed', short: 'Completed', number: 8 },
];

export function getStageIndex(stage: PatientStage): number {
  const idx = STAGES_ORDER.findIndex((s) => s.key === stage);
  return idx >= 0 ? idx : 0;
}

interface PatientJourneyBarProps {
  visit: TokenVisit;
  compact?: boolean;
}

export const PatientJourneyBar: React.FC<PatientJourneyBarProps> = ({ visit, compact = false }) => {
  const [showTimeline, setShowTimeline] = useState(false);
  const currentIndex = getStageIndex(visit.status);

  return (
    <div className="w-full">
      {/* Interactive Bar */}
      <div
        onClick={() => setShowTimeline(true)}
        className="cursor-pointer group select-none"
        title="Click to view detailed stage history and audit timestamps"
      >
        <div className="flex items-center justify-between gap-1 mb-1.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 group-hover:text-teal-700 transition-colors">
            <span className="w-2 h-2 rounded-full bg-teal-500"></span>
            <span>Current Stage:</span>
            <span className="text-teal-800 bg-teal-50 px-2 py-0.5 rounded text-[11px] font-medium border border-teal-200">
              {STAGES_ORDER[currentIndex]?.label || visit.status}
            </span>
          </div>
          <button
            type="button"
            className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 underline decoration-slate-300"
          >
            <History className="w-3 h-3" />
            <span>View Timeline ({visit.stageHistory.length} logs)</span>
          </button>
        </div>

        {/* Progress Grid */}
        <div className="grid grid-cols-8 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
          {STAGES_ORDER.map((stage, idx) => {
            const isCompleted = idx < currentIndex || (idx === 7 && visit.status === 'completed');
            const isCurrent = idx === currentIndex && visit.status !== 'completed';
            const isPending = idx > currentIndex;

            return (
              <div
                key={stage.key}
                className={`relative flex flex-col items-center justify-center py-1.5 px-1 rounded text-center transition-all ${
                  isCurrent
                    ? 'bg-teal-600 text-white font-bold shadow-xs'
                    : isCompleted
                    ? 'bg-teal-100 text-teal-800 font-medium'
                    : 'bg-white/80 text-slate-400 font-normal'
                }`}
              >
                <div className="text-[10px] leading-none mb-0.5 font-mono">
                  {stage.number}
                </div>
                {!compact && (
                  <div className="text-[9px] leading-tight line-clamp-1 truncate w-full px-0.5">
                    {stage.short}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Timeline Modal */}
      {showTimeline && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Patient Journey Audit Timeline</h3>
                <p className="text-xs text-slate-500">
                  Token: {visit.tokenNumber} · Visit ID: {visit.id}
                </p>
              </div>
              <button
                onClick={() => setShowTimeline(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {visit.stageHistory.map((item, i) => {
                  const stageObj = STAGES_ORDER.find((s) => s.key === item.stage);
                  const formattedDate = new Date(item.timestamp).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: true,
                  });

                  return (
                    <div key={i} className="relative">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-teal-600 border-2 border-white ring-2 ring-teal-200" />
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-800">
                            {stageObj?.label || item.stage}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formattedDate}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 mt-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {item.actorName} ({item.actorRole})
                          </span>
                        </div>
                        {item.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-2 mt-2">
                            {item.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowTimeline(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
              >
                Close Timeline
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
