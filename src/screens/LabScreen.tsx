import React, { useMemo, useState } from 'react';
import { FlaskConical, CheckCircle2, Upload, Search, Clock3, Printer, Eye, FileText } from 'lucide-react';
import { useClinic } from '../context/ClinicContext';

export const LabScreen: React.FC = () => {
  const { visits, patients, settings, collectLabSample, uploadLabResult } = useClinic();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ visitId: string; labTestId: string } | null>(null);
  const [summary, setSummary] = useState('');
  const [attachment, setAttachment] = useState('');
  const [view, setView] = useState<'worklist' | 'reports'>('worklist');

  const matchesSearch = (visit: any, lab: any, patient: any) => {
    const query = search.trim().toLowerCase();
    return !query || patient?.name.toLowerCase().includes(query) || patient?.mrn.toLowerCase().includes(query) || visit.tokenNumber.toLowerCase().includes(query) || lab.name.toLowerCase().includes(query);
  };

  const worklist = useMemo(() => visits.flatMap((visit) => (visit.labOrders || [])
    .filter((lab) => lab.billed && !lab.reported)
    .map((lab) => ({ visit, lab, patient: patients.find((p) => p.id === visit.patientId) }))
    .filter(({ visit, lab, patient }) => matchesSearch(visit, lab, patient))), [visits, patients, search]);

  const reported = useMemo(() => visits.flatMap((visit) => (visit.labOrders || [])
    .filter((lab) => lab.billed && lab.reported)
    .map((lab) => ({ visit, lab, patient: patients.find((p) => p.id === visit.patientId) }))
    .filter(({ visit, lab, patient }) => matchesSearch(visit, lab, patient))), [visits, patients, search]);

  const submitResult = async () => {
    if (!selected) return;
    if (await uploadLabResult(selected.visitId, selected.labTestId, summary, attachment)) {
      setSelected(null); setSummary(''); setAttachment('');
      setView('reports');
    }
  };

  const printCurrentLabReports = (item: any) => {
    const escaped = (value = '') => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const currentReports = reported.filter((report) => report.visit.id === item.visit.id);
    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) return;

    const reportSections = currentReports.map((report, index) => {
      const reportedAt = report.lab.reportedAt ? new Date(report.lab.reportedAt).toLocaleString() : '';
      return `<section class="lab-result ${index === 0 ? 'first' : ''}">
        ${index === 0 ? '' : '<div class="continuation">CONTINUED — ' + escaped(item.patient?.name || '') + '</div>'}
        <div class="test-title">${index + 1}. ${escaped(report.lab.name)}</div>
        <div class="report-meta"><div><b>Reported:</b> ${escaped(reportedAt)}</div><div><b>Reported by:</b> ${escaped(report.lab.reportedBy || '')}</div></div>
        <div class="result">${escaped(report.lab.resultSummary || 'See attachment')}</div>
        ${report.lab.resultAttachment ? `<p><b>Attachment / Reference:</b> ${escaped(report.lab.resultAttachment)}</p>` : ''}
      </section>`;
    }).join('');

    popup.document.write(`<!doctype html><html><head><title>Lab Reports - ${escaped(item.patient?.mrn)}</title><style>
      body{font-family:Arial,sans-serif;color:#172033;margin:28px}.report-header{border-bottom:3px solid #0d9488;padding-bottom:12px;margin-bottom:18px}.clinic{font-size:24px;font-weight:bold}.patient{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#f1f5f9;padding:14px;border-radius:8px;font-size:13px;margin-bottom:18px}.lab-result{break-inside:avoid;border-top:1px solid #94a3b8;padding-top:14px;margin-top:18px}.lab-result.first{border-top:0;margin-top:0}.continuation{font-size:10px;color:#64748b;letter-spacing:1px;margin-bottom:12px}.test-title{font-size:17px;font-weight:bold;margin-bottom:8px}.report-meta{display:flex;gap:24px;font-size:11px;color:#64748b;margin-bottom:9px}.result{white-space:pre-wrap;border:1px solid #cbd5e1;padding:14px;line-height:1.55;min-height:85px}.footer{border-top:1px solid #cbd5e1;margin-top:24px;padding-top:10px;font-size:10px;color:#64748b}@media print{button{display:none}body{margin:12mm}}
    </style></head><body>
      <header class="report-header"><div class="clinic">${escaped(settings.clinicName)}</div><div>Laboratory Report — Current Visit</div></header>
      <div class="patient"><div><b>Patient:</b> ${escaped(item.patient?.name || '')}</div><div><b>MRN:</b> ${escaped(item.patient?.mrn || '')}</div><div><b>Token / Visit:</b> ${escaped(item.visit.tokenNumber)}</div><div><b>Reports included:</b> ${currentReports.length}</div></div>
      ${reportSections}
      <div class="footer">Computer generated laboratory report. ${escaped(new Date().toLocaleString())}</div>
      <button onclick="window.print()" style="margin-top:20px;padding:10px 18px;background:#0d9488;color:white;border:0;border-radius:6px;font-weight:bold">Print All Current Reports</button>
    </body></html>`);
    popup.document.close();
  };

  const editResult = (item: any) => {
    setSelected({ visitId: item.visit.id, labTestId: item.lab.labTestId });
    setSummary(item.lab.resultSummary || '');
    setAttachment(item.lab.resultAttachment || '');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div><h2 className="text-xl font-black text-slate-900">Laboratory</h2><p className="text-xs text-slate-500 mt-1">Process samples, upload results, view and print reports.</p></div>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Patient, MRN, token or test" className="pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm w-72" /></div>
      </div>
      <div className="flex gap-2 border-b border-slate-200">
        <button onClick={() => setView('worklist')} className={`px-4 py-2 text-xs font-bold border-b-2 ${view === 'worklist' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}>Pending Work ({worklist.length})</button>
        <button onClick={() => setView('reports')} className={`px-4 py-2 text-xs font-bold border-b-2 ${view === 'reports' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'}`}><span className="inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Completed Reports ({reported.length})</span></button>
      </div>

      {view === 'worklist' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase"><div className="col-span-3">Patient / Token</div><div className="col-span-4">Test</div><div className="col-span-2">Status</div><div className="col-span-3 text-right">Action</div></div>
          {worklist.length === 0 ? <div className="p-10 text-center text-sm text-slate-500"><FlaskConical className="w-8 h-8 mx-auto mb-2 text-slate-300" />No billed laboratory work pending.</div> : worklist.map(({ visit, lab, patient }) => (
            <div key={`${visit.id}-${lab.labTestId}`} className="grid grid-cols-12 gap-3 items-center px-4 py-4 border-t border-slate-100">
              <div className="col-span-3"><div className="font-bold text-sm">{patient?.name}</div><div className="text-[11px] font-mono text-slate-500">{patient?.mrn} · {visit.tokenNumber}</div></div>
              <div className="col-span-4"><div className="font-bold text-sm">{lab.name}</div><div className="text-[11px] text-slate-500">₹{lab.totalPrice}</div></div>
              <div className="col-span-2"><span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${lab.collected ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>{lab.collected ? <CheckCircle2 className="w-3 h-3" /> : <Clock3 className="w-3 h-3" />}{lab.collected ? 'Collected' : 'Awaiting Sample'}</span></div>
              <div className="col-span-3 flex justify-end gap-2">
                {!lab.collected && <button onClick={() => collectLabSample(visit.id, lab.labTestId)} className="px-3 py-2 bg-slate-800 text-white rounded-lg text-xs font-bold">Collect</button>}
                <button onClick={() => editResult({ visit, lab })} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold flex items-center gap-1"><Upload className="w-3 h-3" />Result</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-slate-50 text-[11px] font-bold text-slate-600 uppercase"><div className="col-span-3">Patient / Token</div> <div className="col-span-3">Test</div><div className="col-span-3">Result</div><div className="col-span-3 text-right">Report</div></div>
          {reported.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">No completed laboratory reports found.</div> : reported.map((item) => (
            <div key={`report-${item.visit.id}-${item.lab.labTestId}`} className="grid grid-cols-12 gap-3 items-center px-4 py-4 border-t border-slate-100">
              <div className="col-span-3"><div className="font-bold text-sm">{item.patient?.name}</div><div className="text-[11px] font-mono text-slate-500">{item.patient?.mrn} · {item.visit.tokenNumber}</div></div>
              <div className="col-span-3 font-bold text-sm">{item.lab.name}</div>
              <div className="col-span-3 text-xs text-slate-600 line-clamp-2">{item.lab.resultSummary || item.lab.resultAttachment || 'Result uploaded'}</div>
              <div className="col-span-3 flex justify-end gap-2">
                <button onClick={() => editResult(item)} className="px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold inline-flex items-center gap-1"><Eye className="w-3 h-3" />Edit</button>
                <button onClick={() => printCurrentLabReports(item)} className="px-3 py-2 bg-teal-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1"><Printer className="w-3 h-3" />Print All Current</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4"><div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4"><h3 className="font-black text-slate-900">Upload or Update Laboratory Result</h3><textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} placeholder="Result summary / values / interpretation" className="w-full border border-slate-300 rounded-lg p-3 text-sm" /><input value={attachment} onChange={(e) => setAttachment(e.target.value)} placeholder="Report file URL or attachment reference" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" /><div className="flex justify-end gap-2"><button onClick={() => setSelected(null)} className="px-4 py-2 border rounded-lg text-sm font-bold">Cancel</button><button onClick={submitResult} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold">Save & Upload Result</button></div></div></div>}
    </div>
  );
};
