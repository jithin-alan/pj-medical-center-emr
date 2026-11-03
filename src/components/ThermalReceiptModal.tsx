import React from 'react';
import { Bill } from '../types';
import { Printer, X, CheckCircle2 } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';

interface ThermalReceiptModalProps {
  bill: Bill;
  onClose: () => void;
}

export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({ bill, onClose }) => {
  const { visits, doctors, settings } = useClinic();
  const relatedVisit = visits.find((v) => v.id === bill.visitId || v.consultationReceiptNo === bill.invoiceNo || v.procedureBillId === bill.invoiceNo || v.pharmacyBillId === bill.invoiceNo);
  const relatedDoctor = doctors.find((d) => d.id === relatedVisit?.doctorId);

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(bill.timestamp).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = new Date(bill.timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-800 text-sm">Payment Recorded & Receipt Ready</span>
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
            id="thermal-receipt-print-area"
            className="bg-white border border-slate-300 shadow-sm p-4 text-slate-900 w-[78mm] text-[11px] leading-tight font-mono select-none"
            style={{ minHeight: '110mm' }}
          >
            {/* Header with placeholder clinic info */}
            <div className="text-center pb-2 border-b border-dashed border-slate-400">
              <h2 className="font-bold text-sm tracking-wider uppercase text-slate-950">
                {settings.clinicName}
              </h2>
              <p className="text-[10px] text-slate-600">{settings.address}</p>
              <p className="text-[10px] text-slate-600">
                Ph: {settings.phone} · Reg: {settings.regNumber}
              </p>
            </div>

            {/* Bill Details */}
            <div className="py-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between font-bold text-xs">
                <span>INVOICE #{bill.invoiceNo}</span>
                <span className="uppercase">{bill.status}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-700">
                <span>Date: {formattedDate}</span>
                <span>Time: {formattedTime}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-700">
                <span>Shift: {bill.shift}</span>
                <span>Cashier: {bill.cashierName}</span>
              </div>
            </div>

            {/* Token Callout if Token / Consultation */}
            {relatedVisit?.tokenNumber && (
              <div className="my-2 py-1.5 px-2 bg-slate-100 border border-slate-300 text-center rounded-sm">
                <div className="text-[10px] font-semibold text-slate-600 uppercase">TOKEN NUMBER</div>
                <div className="text-xl font-bold tracking-widest text-slate-950">
                  {relatedVisit.tokenNumber}
                </div>
                {relatedVisit.assignedRoom && (
                  <div className="text-[10px] text-slate-700 font-medium">
                    Assigned: {relatedVisit.assignedRoom}
                  </div>
                )}
              </div>
            )}

            {/* Patient Info */}
            <div className="py-1.5 border-b border-dashed border-slate-400 space-y-0.5 text-[10px]">
              <div><span className="font-semibold">Patient:</span> {bill.patientName}</div>
              <div><span className="font-semibold">MRN:</span> {bill.patientMrn}</div>
              {bill.type === 'consultation' && relatedDoctor && (
                <div>
                  <span className="font-semibold">Doctor:</span>{' '}
                  {relatedDoctor.name} ({relatedDoctor.specialty})
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2 border-b border-dashed border-slate-400">
              <div className="flex justify-between font-bold pb-1 text-[10px] border-b border-slate-300">
                <span className="w-1/2">ITEM / SERVICE</span>
                <span className="w-1/6 text-center">QTY</span>
                <span className="w-1/3 text-right">TOTAL (₹)</span>
              </div>
              <div className="divide-y divide-slate-100 pt-1 space-y-1">
                {bill.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-[10px] pt-1">
                    <span className="w-1/2 font-sans text-[11px] leading-tight">
                      <span className="block">{item.name}</span>
                      {(item.dose || item.duration) && (
                        <span className="block text-[9px] text-slate-600">
                          {item.dose && <>Dose: {item.dose}</>}
                          {item.dose && item.duration && ' · '}
                          {item.duration && <>Duration: {item.duration}</>}
                        </span>
                      )}
                    </span>
                    <span className="w-1/6 text-center">{item.qty}</span>
                    <span className="w-1/3 text-right font-mono">₹{item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Section with Safety GST Note */}
            <div className="pt-2 pb-2 border-b border-dashed border-slate-400 space-y-1">
              <div className="flex justify-between text-[10px]">
                <span>Subtotal:</span>
                <span>₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span>Tax (GST 0%):</span>
                <span>₹0.00</span>
              </div>
              <div className="text-[9px] text-slate-500 italic pb-0.5">
                Note: {settings.gstNote}
              </div>
              <div className="flex justify-between text-xs font-bold pt-1 border-t border-slate-300">
                <span>NET TOTAL PAID:</span>
                <span>₹{bill.total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-700 pt-0.5">
                <span>Payment Mode:</span>
                <span className="uppercase font-semibold">
                  {bill.paymentMethod} {bill.upiRef ? `(${bill.upiRef})` : ''}
                </span>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-3 text-center text-[9px] text-slate-600 space-y-0.5">
              <p className="font-semibold">Thank you for visiting PJ Medical Clinic.</p>
              <p>Please wait for your token to be called on the TV screen.</p>
              <p className="italic text-[8px] pt-1">Demo Prototype System · Not for legal taxation</p>
            </div>
          </div>
        </div>

        {/* Modal Action Footer */}
        <div className="p-4 bg-white border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Press Print or Close</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print 80mm Receipt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
