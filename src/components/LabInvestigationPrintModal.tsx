import React from 'react';
import { PrescribedLabTest } from '../types';
import { Printer, X, FlaskConical } from 'lucide-react';

interface LabInvestigationPrintModalProps {
  visitId: string;
  patientName: string;
  patientMrn: string;
  tokenNumber: string;
  labOrders: PrescribedLabTest[];
  onClose: () => void;
  onPrint: (visitId: string) => Promise<boolean>;
}

export const LabInvestigationPrintModal: React.FC<LabInvestigationPrintModalProps> = ({
  visitId,
  patientName,
  patientMrn,
  tokenNumber,
  labOrders,
  onClose,
  onPrint,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const currentTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

  const handlePrint = async () => {
    await onPrint(visitId);
    window.print();
  };

  const totalLabFee = labOrders.reduce((sum, item) => sum + item.totalPrice, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-indigo-600" />
            <span className="font-semibold text-slate-800 text-sm">Lab Investigation Print</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 80mm Receipt Preview Container */}
        <div className="p-6 bg-slate-100 flex flex-col items-center">
          <p className="text-xs font-medium text-slate-500 mb-3 tracking-wide">
            80mm THERMAL RECEIPT PREVIEW
          </p>

          <div
            id="lab-print-preview"
            className="bg-white border border-slate-300 shadow-sm p-4 text-slate-900 w-[78mm] text-[11px] leading-tight font-mono select-none"
            style={{ minHeight: '110mm' }}
          >
            {/* Clinic Header */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <img src="/clinic-logo.jpg" alt="PJ Medical Center logo" className="w-16 h-16 object-contain mx-auto mb-1" />
              <h2 className="font-bold text-sm tracking-wider uppercase text-slate-950">
                Lab Order Receipt
              </h2>
              <p className="text-[10px] text-slate-600">Token #{tokenNumber}</p>
            </div>

            {/* Patient Info */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div><span className="font-bold">Patient:</span> {patientName}</div>
              <div><span className="font-bold">MRN:</span> {patientMrn}</div>
              <div className="flex justify-between">
                <span><span className="font-bold">Date:</span> {todayStr}</span>
                <span><span className="font-bold">Time:</span> {currentTime}</span>
              </div>
            </div>

            {/* Lab Tests Table */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <div className="text-xs font-bold uppercase tracking-wider mb-2">Laboratory Tests</div>
              {labOrders.length === 0 ? (
                <div className="text-[10px] text-slate-600">No tests ordered</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {labOrders.map((test, i) => (
                    <div key={i} className="py-1 flex justify-between">
                      <div>
                        <div className="font-bold">{test.name}</div>
                        {test.notes && <div className="text-[9px] text-slate-600">{test.notes}</div>}
                      </div>
                      <div className="font-mono">₹{test.totalPrice.toFixed(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total Section */}
            <div className="pt-2 bg-slate-50">
              <div className="flex justify-between text-xs font-bold">
                <span>TOTAL LAB FEE:</span>
                <span>₹{totalLabFee.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-3 text-center text-[9px] text-slate-600 space-y-0.5">
            <p>Please wait for laboratory results.</p>
            <p className="italic text-[8px] pt-1">Demo Prototype System · Not for legal use</p>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Lab Order</span>
          </button>
        </div>
      </div>
    </div>
  );
};