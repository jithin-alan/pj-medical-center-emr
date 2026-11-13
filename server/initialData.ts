import {
  Doctor,
  Room,
  DrugItem,
  DrugBatch,
  ProcedureCatalogueItem,
  LabTestCatalogueItem,
  ClinicalTemplate,
  Patient,
  TokenVisit,
  Bill,
  ShiftRecord,
  AuditLog,
  StaffAccount,
  ClinicSettings
} from './types';

export const INITIAL_SETTINGS: ClinicSettings = {
  clinicName: 'PJ Medical Center',
  address: 'Mammodu, Kollam, Kerala',
  phone: '+91 82821038615',
  regNumber: 'KL/TVL/2026/001 [Placeholder]',
  gstNote: 'GST configuration pending - confirm with accountant.',
};

export const INITIAL_STAFF_ACCOUNTS: StaffAccount[] = [
  { id: 'staff-admin', name: 'Clinic Administrator', email: 'admin@pjmedical.local', phone: '', role: 'admin', modules: ['admin', 'audit', 'accounts'], active: true, shift: 'Shift A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-doc-1', name: 'Dr. Jithin Mohan', email: 'jithin.mohan@pjmedical.local', phone: '', role: 'doctor', modules: ['doctor'], active: true, shift: 'Shift A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-doc-2', name: 'Dr. Poornima', email: 'poornima@pjmedical.local', phone: '', role: 'doctor', modules: ['doctor'], active: true, shift: 'Shift B', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-doc-3', name: 'Dr. X', email: 'dr.x@pjmedical.local', phone: '', role: 'doctor', modules: ['doctor'], active: true, shift: 'Shift C', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-nurse-1', name: 'Nurse Asha Kumar', email: 'asha.kumar@pjmedical.local', phone: '', role: 'nurse', modules: ['nurse', 'receptionist'], active: true, shift: 'Shift A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-nurse-2', name: 'Nurse Sreeja Das', email: 'sreeja.das@pjmedical.local', phone: '', role: 'nurse', modules: ['nurse', 'receptionist', 'pharmacist'], active: true, shift: 'Shift A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-nurse-3', name: 'Nurse Priya Raj', email: 'priya.raj@pjmedical.local', phone: '', role: 'nurse', modules: ['nurse', 'receptionist'], active: true, shift: 'Shift B', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-nurse-4', name: 'Nurse Divya Lal', email: 'divya.lal@pjmedical.local', phone: '', role: 'nurse', modules: ['nurse', 'receptionist', 'pharmacist'], active: true, shift: 'Shift C', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-phm-1', name: 'Pharmacist Arun S', email: 'arun.s@pjmedical.local', phone: '', role: 'pharmacist', modules: ['pharmacist'], active: true, shift: 'Shift A', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'staff-phm-2', name: 'Pharmacist Nisha Varma', email: 'nisha.varma@pjmedical.local', phone: '', role: 'pharmacist', modules: ['pharmacist'], active: true, shift: 'Shift B', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
];

export const INITIAL_DOCTORS: Doctor[] = [
  {
    id: 'doc-1',
    name: 'Dr. Jithin Mohan',
    specialty: 'General Medicine & Diabetology',
    qualification: 'MBBS, MD (Gen Med)',
    registrationNumber: 'TCMC-2015-8492 [Placeholder]',
    tokenPrefix: 'D1',
    consultationFee: 300,
    shift: 'Shift A',
    startTime: '08:00',
    endTime: '14:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    roomId: 'room-1',
  },
  {
    id: 'doc-2',
    name: 'Dr. Poornima',
    specialty: 'Consultant Pediatrician',
    qualification: 'MBBS, DCH, DNB (Peds)',
    registrationNumber: 'TCMC-2018-9120 [Placeholder]',
    tokenPrefix: 'D2',
    consultationFee: 300,
    shift: 'Shift B',
    startTime: '14:00',
    endTime: '20:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    roomId: 'room-1',
  },
  {
    id: 'doc-3',
    name: 'Dr. X',
    specialty: 'Resident Medical Officer (RMO)',
    qualification: 'MBBS (Emergency & OP)',
    registrationNumber: 'TCMC-2022-1045 [Placeholder]',
    tokenPrefix: 'D3',
    consultationFee: 300,
    shift: 'Shift C',
    startTime: '20:00',
    endTime: '23:00',
    workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    roomId: 'room-2',
  },
];

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'room-1',
    name: 'Room 1',
    occupiedByDoctorId: 'doc-1',
    occupiedByDoctorName: 'Dr. Jithin Mohan',
    currentTokenNumber: 'D1-001',
    occupiedAt: '2026-10-25T09:15:00',
  },
  {
    id: 'room-2',
    name: 'Room 2',
    occupiedByDoctorId: 'doc-2',
    occupiedByDoctorName: 'Dr. Poornima',
    currentTokenNumber: null,
    occupiedAt: '2026-10-25T14:00:00',
  },
];

export const INITIAL_DRUGS: DrugItem[] = [
  { id: 'd-01', name: 'Dolo 650', genericName: 'Paracetamol', strength: '650mg', form: 'Tablet', unitPrice: 32, reorderLevel: 30, allergyClass: 'Analgesics / Antipyretics' },
  { id: 'd-02', name: 'Augmentin 625', genericName: 'Amoxicillin + Clavulanic Acid', strength: '625mg', form: 'Tablet', unitPrice: 198, reorderLevel: 15, allergyClass: 'Penicillins', contraindicatedAllergies: ['Penicillins', 'Amoxicillin'] },
  { id: 'd-03', name: 'Azee 500', genericName: 'Azithromycin', strength: '500mg', form: 'Tablet', unitPrice: 125, reorderLevel: 10, allergyClass: 'Macrolides', contraindicatedAllergies: ['Macrolides'] },
  { id: 'd-04', name: 'Pan 40', genericName: 'Pantoprazole', strength: '40mg', form: 'Tablet', unitPrice: 85, reorderLevel: 25, allergyClass: 'Proton Pump Inhibitors' },
  { id: 'd-05', name: 'Glycomet 500', genericName: 'Metformin Hydrochloride', strength: '500mg', form: 'Tablet', unitPrice: 28, reorderLevel: 40, allergyClass: 'Biguanides' },
  { id: 'd-06', name: 'Telma 40', genericName: 'Telmisartan', strength: '40mg', form: 'Tablet', unitPrice: 94, reorderLevel: 20, allergyClass: 'Angiotensin Receptor Blockers' },
  { id: 'd-07', name: 'Cetzine', genericName: 'Cetirizine Hydrochloride', strength: '10mg', form: 'Tablet', unitPrice: 35, reorderLevel: 20, allergyClass: 'Antihistamines' },
  { id: 'd-08', name: 'Montair LC', genericName: 'Montelukast + Levocetirizine', strength: '10mg/5mg', form: 'Tablet', unitPrice: 160, reorderLevel: 15, allergyClass: 'Leukotriene Receptor Antagonists' },
  { id: 'd-09', name: 'Ciplox 500', genericName: 'Ciprofloxacin', strength: '500mg', form: 'Tablet', unitPrice: 42, reorderLevel: 20, allergyClass: 'Fluoroquinolones', contraindicatedAllergies: ['Fluoroquinolones'] },
  { id: 'd-10', name: 'Electral Sachet', genericName: 'Oral Rehydration Salts IP', strength: '21.8g', form: 'Sachet', unitPrice: 22, reorderLevel: 30, allergyClass: 'Electrolytes' },
  { id: 'd-11', name: 'Combiflam', genericName: 'Ibuprofen + Paracetamol', strength: '400mg/325mg', form: 'Tablet', unitPrice: 45, reorderLevel: 25, allergyClass: 'NSAIDs / Aspirin', contraindicatedAllergies: ['NSAIDs / Aspirin', 'Ibuprofen'] },
  { id: 'd-12', name: 'Razo D', genericName: 'Rabeprazole + Domperidone', strength: '20mg/30mg', form: 'Capsule', unitPrice: 145, reorderLevel: 15, allergyClass: 'Proton Pump Inhibitors' },
  { id: 'd-13', name: 'Emeset 4', genericName: 'Ondansetron', strength: '4mg', form: 'Tablet', unitPrice: 48, reorderLevel: 15, allergyClass: '5-HT3 Antagonists' },
  { id: 'd-14', name: 'Asthalin Inhaler', genericName: 'Salbutamol Inhaler', strength: '100mcg (200 mdi)', form: 'Inhaler', unitPrice: 165, reorderLevel: 5, allergyClass: 'Beta-2 Agonists' },
  { id: 'd-15', name: 'Budecort 0.5 Respules', genericName: 'Budesonide Respules', strength: '0.5mg/2ml', form: 'Drops', unitPrice: 28, reorderLevel: 20, allergyClass: 'Corticosteroids' },
  { id: 'd-16', name: 'Flagyl 400', genericName: 'Metronidazole', strength: '400mg', form: 'Tablet', unitPrice: 24, reorderLevel: 20, allergyClass: 'Nitroimidazoles' },
  { id: 'd-17', name: 'Voveran 50', genericName: 'Diclofenac Sodium', strength: '50mg', form: 'Tablet', unitPrice: 55, reorderLevel: 15, allergyClass: 'NSAIDs / Aspirin', contraindicatedAllergies: ['NSAIDs / Aspirin', 'Diclofenac'] },
  { id: 'd-18', name: 'Tramazac 50', genericName: 'Tramadol Hydrochloride', strength: '50mg', form: 'Capsule', unitPrice: 78, reorderLevel: 10, allergyClass: 'Opioids' },
  { id: 'd-19', name: 'Atorva 20', genericName: 'Atorvastatin', strength: '20mg', form: 'Tablet', unitPrice: 135, reorderLevel: 15, allergyClass: 'Statins' },
  { id: 'd-20', name: 'Amlong 5', genericName: 'Amlodipine Besylate', strength: '5mg', form: 'Tablet', unitPrice: 38, reorderLevel: 25, allergyClass: 'Calcium Channel Blockers' },
  { id: 'd-21', name: 'Amaryl 1', genericName: 'Glimepiride', strength: '1mg', form: 'Tablet', unitPrice: 65, reorderLevel: 15, allergyClass: 'Sulphonamides', contraindicatedAllergies: ['Sulphonamides', 'Sulfa drugs'] },
  { id: 'd-22', name: 'Becosules', genericName: 'Vitamin B Complex + Vitamin C', strength: 'Standard', form: 'Capsule', unitPrice: 42, reorderLevel: 30, allergyClass: 'Vitamins' },
  { id: 'd-23', name: 'Rantac 150', genericName: 'Ranitidine Hydrochloride', strength: '150mg', form: 'Tablet', unitPrice: 30, reorderLevel: 20, allergyClass: 'H2 Blockers' },
  { id: 'd-24', name: 'Ascoril D Syrup', genericName: 'Dextromethorphan + CPM + Phenylephrine', strength: '100ml', form: 'Syrup', unitPrice: 118, reorderLevel: 10, allergyClass: 'Antitussives' },
  { id: 'd-25', name: 'Mucolite Syrup', genericName: 'Ambroxol Hydrochloride', strength: '100ml', form: 'Syrup', unitPrice: 95, reorderLevel: 10, allergyClass: 'Mucolytics' },
  { id: 'd-26', name: 'Candid Cream', genericName: 'Clotrimazole 1% w/w', strength: '30g', form: 'Ointment', unitPrice: 110, reorderLevel: 8, allergyClass: 'Antifungals' },
  { id: 'd-27', name: 'Betadine 5% Ointment', genericName: 'Povidone Iodine', strength: '20g', form: 'Ointment', unitPrice: 85, reorderLevel: 10, allergyClass: 'Iodine Antiseptics' },
  { id: 'd-28', name: 'Taxim-O 200', genericName: 'Cefixime', strength: '200mg', form: 'Tablet', unitPrice: 140, reorderLevel: 12, allergyClass: 'Cephalosporins', contraindicatedAllergies: ['Cephalosporins', 'Penicillins'] },
  { id: 'd-29', name: 'Happi 20', genericName: 'Rabeprazole Sodium', strength: '20mg', form: 'Tablet', unitPrice: 88, reorderLevel: 15, allergyClass: 'Proton Pump Inhibitors' },
  // Intentionally leaving Shelcal 500 without allergyClass to test Safety Rule 2: "Allergy check not available for this drug - doctor to confirm"
  { id: 'd-30', name: 'Shelcal 500', genericName: 'Calcium Carbonate + Vit D3', strength: '500mg/250IU', form: 'Tablet', unitPrice: 98, reorderLevel: 20, allergyClass: null },
  { id: 'd-31', name: 'Calpol 250 Suspension', genericName: 'Paracetamol Suspension', strength: '250mg/5ml', form: 'Syrup', unitPrice: 55, reorderLevel: 10, allergyClass: 'Analgesics / Antipyretics' },
  { id: 'd-32', name: 'Avil 25', genericName: 'Pheniramine Maleate', strength: '25mg', form: 'Tablet', unitPrice: 18, reorderLevel: 20, allergyClass: 'Antihistamines' },
  { id: 'd-33', name: 'Benadryl Syrup', genericName: 'Diphenhydramine + Ammonium Chloride + Sodium Citrate', strength: '100ml', form: 'Syrup', unitPrice: 125, reorderLevel: 10, allergyClass: 'Antitussives' },
  { id: 'd-34', name: 'Diclo Gel', genericName: 'Diclofenac Diethylamine Gel', strength: '30g', form: 'Ointment', unitPrice: 92, reorderLevel: 15, allergyClass: 'NSAIDs / Aspirin', contraindicatedAllergies: ['NSAIDs / Aspirin', 'Diclofenac'] },
  { id: 'd-35', name: 'Deriphyllin Injection', genericName: 'Etophylline + Theophylline', strength: '2ml', form: 'Injection', unitPrice: 38, reorderLevel: 8, allergyClass: 'Xanthines' },
];

// Current local time anchor is 2026-10-25
export const INITIAL_BATCHES: DrugBatch[] = [
  // Dolo 650: Two batches: one near-expiry (expires 2026-11-10, in 16 days!), one fresh (expires 2027-08-30)
  { id: 'b-01', drugId: 'd-01', batchNumber: 'DL-24K09', expiryDate: '2026-11-10', quantity: 40, purchasePrice: 24, supplier: 'Kerala Pharma Dist.', dateReceived: '2025-05-10' },
  { id: 'b-02', drugId: 'd-01', batchNumber: 'DL-25A14', expiryDate: '2027-08-30', quantity: 140, purchasePrice: 25, supplier: 'Kerala Pharma Dist.', dateReceived: '2026-02-15' },

  // Augmentin 625: One EXPIRED batch (expired 2026-09-30, blocked from dispensing) & one fresh
  { id: 'b-03', drugId: 'd-02', batchNumber: 'AUG-24J01', expiryDate: '2026-09-30', quantity: 20, purchasePrice: 140, supplier: 'Glaxo Dist. Cochin', dateReceived: '2024-10-01' },
  { id: 'b-04', drugId: 'd-02', batchNumber: 'AUG-25C08', expiryDate: '2027-04-30', quantity: 50, purchasePrice: 145, supplier: 'Glaxo Dist. Cochin', dateReceived: '2026-03-20' },

  // Azee 500
  { id: 'b-05', drugId: 'd-03', batchNumber: 'AZ-25B02', expiryDate: '2027-05-31', quantity: 45, purchasePrice: 90, supplier: 'Cipla Depot Ernakulam', dateReceived: '2026-01-10' },

  // Pan 40: One near-expiry (expires 2026-11-20, in 26 days) & one regular
  { id: 'b-06', drugId: 'd-04', batchNumber: 'PAN-24L03', expiryDate: '2026-11-20', quantity: 30, purchasePrice: 60, supplier: 'Alkem Agencies', dateReceived: '2025-06-01' },
  { id: 'b-07', drugId: 'd-04', batchNumber: 'PAN-25E12', expiryDate: '2027-09-30', quantity: 90, purchasePrice: 62, supplier: 'Alkem Agencies', dateReceived: '2026-05-15' },

  // Glycomet 500
  { id: 'b-08', drugId: 'd-05', batchNumber: 'GLY-25D05', expiryDate: '2027-10-31', quantity: 220, purchasePrice: 18, supplier: 'USV Direct', dateReceived: '2026-04-10' },

  // Telma 40
  { id: 'b-09', drugId: 'd-06', batchNumber: 'TEL-25F01', expiryDate: '2027-11-30', quantity: 140, purchasePrice: 65, supplier: 'Glenmark Logistics', dateReceived: '2026-06-01' },

  // Cetzine
  { id: 'b-10', drugId: 'd-07', batchNumber: 'CET-25C19', expiryDate: '2027-06-30', quantity: 95, purchasePrice: 22, supplier: 'Dr Reddys Depot', dateReceived: '2026-03-12' },

  // Montair LC
  { id: 'b-11', drugId: 'd-08', batchNumber: 'MON-25A04', expiryDate: '2027-03-31', quantity: 60, purchasePrice: 110, supplier: 'Cipla Depot Ernakulam', dateReceived: '2026-01-15' },

  // Ciplox 500: One expired batch (expired 2026-10-01) & one valid
  { id: 'b-12', drugId: 'd-09', batchNumber: 'CIP-24H08', expiryDate: '2026-10-01', quantity: 15, purchasePrice: 28, supplier: 'Cipla Depot Ernakulam', dateReceived: '2024-09-10' },
  { id: 'b-13', drugId: 'd-09', batchNumber: 'CIP-25G11', expiryDate: '2027-12-31', quantity: 80, purchasePrice: 30, supplier: 'Cipla Depot Ernakulam', dateReceived: '2026-07-20' },

  // Electral Sachet
  { id: 'b-14', drugId: 'd-10', batchNumber: 'ELE-25B18', expiryDate: '2027-08-31', quantity: 150, purchasePrice: 14, supplier: 'FDC Sales Kerala', dateReceived: '2026-02-18' },

  // Combiflam
  { id: 'b-15', drugId: 'd-11', batchNumber: 'COM-25E03', expiryDate: '2027-11-30', quantity: 110, purchasePrice: 31, supplier: 'Sanofi India Ltd', dateReceived: '2026-05-02' },

  // Razo D
  { id: 'b-16', drugId: 'd-12', batchNumber: 'RAZ-25C09', expiryDate: '2027-06-30', quantity: 75, purchasePrice: 102, supplier: 'Dr Reddys Depot', dateReceived: '2026-03-15' },

  // Emeset 4
  { id: 'b-17', drugId: 'd-13', batchNumber: 'EME-25D01', expiryDate: '2027-07-31', quantity: 65, purchasePrice: 32, supplier: 'Cipla Depot Ernakulam', dateReceived: '2026-04-05' },

  // Asthalin Inhaler: Out of stock (0 quantity)
  { id: 'b-18', drugId: 'd-14', batchNumber: 'AST-24X00', expiryDate: '2026-12-31', quantity: 0, purchasePrice: 120, supplier: 'Cipla Depot Ernakulam', dateReceived: '2025-01-10' },

  // Budecort 0.5
  { id: 'b-19', drugId: 'd-15', batchNumber: 'BUD-25E07', expiryDate: '2027-09-30', quantity: 85, purchasePrice: 18, supplier: 'Cipla Depot Ernakulam', dateReceived: '2026-05-12' },

  // Flagyl 400
  { id: 'b-20', drugId: 'd-16', batchNumber: 'FLA-25F14', expiryDate: '2027-10-31', quantity: 90, purchasePrice: 15, supplier: 'Abbott Healthcare', dateReceived: '2026-06-18' },

  // Voveran 50
  { id: 'b-21', drugId: 'd-17', batchNumber: 'VOV-25C22', expiryDate: '2027-08-31', quantity: 70, purchasePrice: 36, supplier: 'Novartis India', dateReceived: '2026-03-25' },

  // Tramazac 50
  { id: 'b-22', drugId: 'd-18', batchNumber: 'TRZ-25B06', expiryDate: '2027-05-31', quantity: 30, purchasePrice: 52, supplier: 'Zydus Cadila', dateReceived: '2026-02-10' },

  // Atorva 20
  { id: 'b-23', drugId: 'd-19', batchNumber: 'ATO-25G03', expiryDate: '2027-12-31', quantity: 85, purchasePrice: 92, supplier: 'Zydus Cadila', dateReceived: '2026-07-08' },

  // Amlong 5
  { id: 'b-24', drugId: 'd-20', batchNumber: 'AML-25H09', expiryDate: '2028-01-31', quantity: 130, purchasePrice: 25, supplier: 'Micro Labs Ltd', dateReceived: '2026-08-14' },

  // Amaryl 1
  { id: 'b-25', drugId: 'd-21', batchNumber: 'AMA-25D11', expiryDate: '2027-09-30', quantity: 55, purchasePrice: 42, supplier: 'Sanofi India Ltd', dateReceived: '2026-04-20' },

  // Becosules
  { id: 'b-26', drugId: 'd-22', batchNumber: 'BEC-25A19', expiryDate: '2027-07-31', quantity: 160, purchasePrice: 28, supplier: 'Pfizer India', dateReceived: '2026-01-22' },

  // Rantac 150
  { id: 'b-27', drugId: 'd-23', batchNumber: 'RAN-25C05', expiryDate: '2027-06-30', quantity: 90, purchasePrice: 19, supplier: 'JB Chemicals', dateReceived: '2026-03-10' },

  // Ascoril D Syrup
  { id: 'b-28', drugId: 'd-24', batchNumber: 'ASC-25E15', expiryDate: '2027-10-31', quantity: 40, purchasePrice: 78, supplier: 'Glenmark Logistics', dateReceived: '2026-05-19' },

  // Mucolite Syrup
  { id: 'b-29', drugId: 'd-25', batchNumber: 'MUC-25D08', expiryDate: '2027-08-31', quantity: 35, purchasePrice: 62, supplier: 'Dr Reddys Depot', dateReceived: '2026-04-14' },

  // Candid Cream
  { id: 'b-30', drugId: 'd-26', batchNumber: 'CAN-25F10', expiryDate: '2027-11-30', quantity: 25, purchasePrice: 70, supplier: 'Glenmark Logistics', dateReceived: '2026-06-15' },

  // Betadine 5%
  { id: 'b-31', drugId: 'd-27', batchNumber: 'BET-25G04', expiryDate: '2027-12-31', quantity: 45, purchasePrice: 55, supplier: 'Win-Medicare', dateReceived: '2026-07-02' },

  // Taxim-O 200
  { id: 'b-32', drugId: 'd-28', batchNumber: 'TAX-25B12', expiryDate: '2027-05-31', quantity: 50, purchasePrice: 94, supplier: 'Alkem Agencies', dateReceived: '2026-02-25' },

  // Happi 20
  { id: 'b-33', drugId: 'd-29', batchNumber: 'HAP-25C17', expiryDate: '2027-06-30', quantity: 60, purchasePrice: 58, supplier: 'Zydus Cadila', dateReceived: '2026-03-28' },

  // Shelcal 500
  { id: 'b-34', drugId: 'd-30', batchNumber: 'SHE-25E21', expiryDate: '2027-10-31', quantity: 110, purchasePrice: 64, supplier: 'Torrent Pharma', dateReceived: '2026-05-30' },

  // Additional dummy retail stock
  { id: 'b-35', drugId: 'd-31', batchNumber: 'CAL-26A01', expiryDate: '2027-12-31', quantity: 85, purchasePrice: 38, supplier: 'GSK Consumer Healthcare', dateReceived: '2026-06-02' },
  { id: 'b-36', drugId: 'd-32', batchNumber: 'AVI-26B04', expiryDate: '2027-09-30', quantity: 120, purchasePrice: 12, supplier: 'Sanofi India Ltd', dateReceived: '2026-07-15' },
  { id: 'b-37', drugId: 'd-33', batchNumber: 'BEN-26C08', expiryDate: '2027-08-31', quantity: 45, purchasePrice: 82, supplier: 'Johnson & Johnson', dateReceived: '2026-08-04' },
  { id: 'b-38', drugId: 'd-34', batchNumber: 'DCL-26D12', expiryDate: '2028-01-31', quantity: 60, purchasePrice: 65, supplier: 'Novartis India', dateReceived: '2026-09-01' },
  { id: 'b-39', drugId: 'd-35', batchNumber: 'DER-26E06', expiryDate: '2027-06-30', quantity: 30, purchasePrice: 25, supplier: 'Zydus Cadila', dateReceived: '2026-09-12' },
];

export const INITIAL_LAB_TESTS: LabTestCatalogueItem[] = [
  { id: 'lab-01', name: 'Complete Blood Count (CBC)', category: 'Haematology', price: 350, sample: 'EDTA blood', turnaround: 'Same day' },
  { id: 'lab-02', name: 'Fasting Blood Sugar', category: 'Biochemistry', price: 120, sample: 'Serum/plasma', turnaround: 'Same day' },
  { id: 'lab-03', name: 'HbA1c', category: 'Biochemistry', price: 650, sample: 'EDTA blood', turnaround: '1 day' },
  { id: 'lab-04', name: 'Lipid Profile', category: 'Biochemistry', price: 550, sample: 'Serum', turnaround: 'Same day' },
  { id: 'lab-05', name: 'Liver Function Test', category: 'Biochemistry', price: 700, sample: 'Serum', turnaround: '1 day' },
  { id: 'lab-06', name: 'Renal Function Test', category: 'Biochemistry', price: 650, sample: 'Serum', turnaround: '1 day' },
  { id: 'lab-07', name: 'Urine Routine & Microscopy', category: 'Microbiology', price: 180, sample: 'Urine', turnaround: 'Same day' },
  { id: 'lab-08', name: 'Chest X-Ray (PA View)', category: 'Radiology', price: 450, sample: 'No sample', turnaround: 'Same day' },
  { id: 'lab-09', name: 'Dengue NS1 Antigen', category: 'Serology', price: 800, sample: 'Serum', turnaround: 'Same day' },
];

export const INITIAL_PROCEDURES: ProcedureCatalogueItem[] = [
  { id: 'proc-01', name: 'IV Fluid Infusion (Normal Saline 500ml)', category: 'IV Fluid', price: 250, description: 'Sterile IV set + cannula insertion + 500ml Normal Saline' },
  { id: 'proc-02', name: 'IV Fluid Infusion (Ringer Lactate 500ml)', category: 'IV Fluid', price: 280, description: 'Sterile IV set + cannula insertion + 500ml RL' },
  { id: 'proc-03', name: 'IM/IV Injection Administration', category: 'Injection', price: 80, description: 'Disposable syringe + nursing administration fee' },
  { id: 'proc-04', name: 'Tetanus Toxoid (TT) 0.5ml IM', category: 'Injection', price: 120, description: 'Vaccine vial + sterile auto-disable syringe administration' },
  { id: 'proc-05', name: 'Nebulisation with Salbutamol', category: 'Procedure', price: 150, description: 'Compressor nebuliser session + disposable mask' },
  { id: 'proc-06', name: 'Nebulisation with Budecort', category: 'Procedure', price: 180, description: 'Corticosteroid nebuliser session + disposable mask' },
  { id: 'proc-07', name: '12-Lead Electrocardiogram (ECG)', category: 'Diagnostics', price: 350, description: 'Standard 12-lead strip with automated & physician reading' },
  { id: 'proc-08', name: 'Minor Wound Dressing (Small/Abrasions)', category: 'Dressing', price: 150, description: 'Antiseptic wash + sterile gauze dressing' },
  { id: 'proc-09', name: 'Major Wound Dressing (Deep/Extensive)', category: 'Dressing', price: 300, description: 'Debridement, povidone cleansing + padded compression dressing' },
  { id: 'proc-10', name: 'Suture Removal & Antiseptic Cleaning', category: 'Procedure', price: 200, description: 'Sterile stitch cutter + betadine dressing' },
  { id: 'proc-11', name: 'Random Blood Sugar (Glucometer test)', category: 'Diagnostics', price: 70, description: 'Instant capillary glucose test + report strip' },
  { id: 'proc-12', name: "Foley's Urinary Catheterisation", category: 'Procedure', price: 450, description: 'Silicone/latex Foley catheter insertion + urobag' },
];

// Per-Doctor Clinical Templates (Stage 3 Requirement)
export const INITIAL_TEMPLATES: ClinicalTemplate[] = [
  // Doctor 1 Templates
  {
    id: 'tpl-d1-urti',
    doctorId: 'doc-1',
    name: 'Doctor 1: Acute Viral Cold & URTI',
    chiefComplaint: 'Running nose, dry cough, mild fever and sore throat for 3 days.',
    history: 'Onset 3 days ago. No breathlessness, no chest pain. Eating well, sleeping well. No known drug allergy.',
    examination: 'Throat: mild pharyngeal congestion. Chest: bilaterally clear, no wheeze. Temp: 99.2°F, SpO2: 98%.',
    diagnosis: 'Acute Viral Upper Respiratory Tract Infection (URTI)',
    plan: 'Warm saline gargle 3 times daily. Steam inhalation. Adequate oral hydration. Review after 3 days if fever persists.',
    suggestedMeds: [
      { drugName: 'Dolo 650', strength: '650mg', form: 'Tablet', dose: '1 tab', frequency: 'TDS (after food)', duration: '3 days', instructions: 'Take for fever or body ache', isOutsideMedicine: false, unitPrice: 32, qtyToDispense: 10, qtyDispensed: 0, dispensed: false },
      { drugName: 'Cetzine', strength: '10mg', form: 'Tablet', dose: '1 tab', frequency: 'HS (at bedtime)', duration: '5 days', instructions: 'May cause mild drowsiness', isOutsideMedicine: false, unitPrice: 35, qtyToDispense: 5, qtyDispensed: 0, dispensed: false },
    ],
  },
  {
    id: 'tpl-d1-dm',
    doctorId: 'doc-1',
    name: 'Doctor 1: Type 2 Diabetes Mellitus Review',
    chiefComplaint: 'Routine diabetes check-up. Mild fatigue and burning sensation in feet.',
    history: 'Known T2DM for 6 years on oral hypoglycemics. Good compliance. No polyuria or polydipsia currently.',
    examination: 'Bilateral pedal pulses palpable. No foot ulcers. Sensations intact on monofilament. BP: 130/80 mmHg.',
    diagnosis: 'Type 2 Diabetes Mellitus - Follow-up review',
    plan: 'Continue low glycemic diet, daily 30-min brisk walk. Foot care hygiene. Check HbA1c, FBS, PPBS and Serum Creatinine.',
    suggestedMeds: [
      { drugName: 'Glycomet 500', strength: '500mg', form: 'Tablet', dose: '1 tab', frequency: 'BD (with meals)', duration: '30 days', instructions: 'Take strictly with breakfast and dinner', isOutsideMedicine: false, unitPrice: 28, qtyToDispense: 60, qtyDispensed: 0, dispensed: false },
      { drugName: 'Becosules', strength: 'Standard', form: 'Capsule', dose: '1 cap', frequency: 'OD (after lunch)', duration: '30 days', instructions: 'Nutritional supplement', isOutsideMedicine: false, unitPrice: 42, qtyToDispense: 30, qtyDispensed: 0, dispensed: false }
    ],
    suggestedProcedures: [
      { procedureId: 'proc-11', qty: 1, notes: 'Check spot capillary blood glucose now' }
    ]
  },

  // Doctor 2 Templates (Pediatrics)
  {
    id: 'tpl-d2-wheeze',
    doctorId: 'doc-2',
    name: 'Doctor 2: Acute Bronchospasm / Wheeze in Child',
    chiefComplaint: 'Bilateral wheezing, persistent dry cough worsening at night.',
    history: 'History of allergic bronchitis. Triggered by recent dust exposure. No cyanosis.',
    examination: 'Chest auscultation: bilateral expiratory wheezes. No subcostal retractions. SpO2: 96% on room air.',
    diagnosis: 'Acute Bronchospasm / Mild Asthmatic Exacerbation',
    plan: 'Stat Nebulisation with Salbutamol and Budecort. Re-assess chest after 20 minutes.',
    suggestedMeds: [
      { drugName: 'Montair LC', strength: '10mg/5mg', form: 'Tablet', dose: '1/2 tab', frequency: 'OD at night', duration: '7 days', instructions: 'Take after dinner', isOutsideMedicine: false, unitPrice: 160, qtyToDispense: 4, qtyDispensed: 0, dispensed: false }
    ],
    suggestedProcedures: [
      { procedureId: 'proc-05', qty: 1, notes: 'Stat nebulisation with 2.5ml saline' }
    ]
  },

  // Doctor 3 Templates (RMO / General OP)
  {
    id: 'tpl-d3-ge',
    doctorId: 'doc-3',
    name: 'Doctor 3: Acute Gastroenteritis / Dehydration',
    chiefComplaint: 'Loose watery stools (4-5 episodes) and nausea with abdominal cramps since yesterday.',
    history: 'Ate outside food 24 hours ago. Vomited once. Mild thirst, passing urine regularly.',
    examination: 'Abdomen: soft, mild periumbilical tenderness, bowel sounds hyperactive. No rebound tenderness. Tongue mildly dry.',
    diagnosis: 'Acute Infective Gastroenteritis with Mild Dehydration',
    plan: 'Oral rehydration solution (Electral) - 1 glass after each loose motion. Light bland diet (kanji, toast).',
    suggestedMeds: [
      { drugName: 'Electral Sachet', strength: '21.8g', form: 'Sachet', dose: '1 sachet in 1L water', frequency: 'Frequent sips', duration: '2 days', instructions: 'Dissolve fully in clean drinking water', isOutsideMedicine: false, unitPrice: 22, qtyToDispense: 3, qtyDispensed: 0, dispensed: false },
      { drugName: 'Razo D', strength: '20mg/30mg', form: 'Capsule', dose: '1 cap', frequency: 'BD (before food)', duration: '3 days', instructions: 'Take 30 mins before breakfast and dinner', isOutsideMedicine: false, unitPrice: 145, qtyToDispense: 6, qtyDispensed: 0, dispensed: false },
    ],
    suggestedProcedures: [
      { procedureId: 'proc-01', qty: 1, notes: 'Infuse 500ml NS over 1 hour for hydration' }
    ]
  }
];

export const INITIAL_PATIENTS: Patient[] = [
  {
    id: 'pat-001',
    mrn: 'PJ-000001',
    name: 'K. V. Narayanan',
    age: 58,
    sex: 'Male',
    phone: '+91 98471 23456',
    allergies: ['Penicillins'],
    pastHistory: 'Type 2 Diabetes Mellitus (5 y), Hypertension (8 y), No previous surgeries.',
    registeredAt: '2026-10-24T10:00:00',
  },
  {
    id: 'pat-002',
    mrn: 'PJ-000002',
    name: 'Mathew Thomas',
    age: 64,
    sex: 'Male',
    phone: '+91 98471 23456', // Same phone as pat-001 to demonstrate multiple patients per phone!
    allergies: ['Sulphonamides'],
    pastHistory: 'Ischemic Heart Disease (3 y), Cerebrovascular Disease, Joint replacements (left knee).',
    registeredAt: '2026-10-24T14:15:00',
  },
  {
    id: 'pat-003',
    mrn: 'PJ-000003',
    name: 'Priya Anilkumar',
    age: 32,
    sex: 'Female',
    phone: '+91 94470 56789',
    allergies: [],
    pastHistory: 'No significant chronic illnesses. No known drug allergies.',
    registeredAt: '2026-10-24T11:30:00',
  },
  {
    id: 'pat-004',
    mrn: 'PJ-000004',
    name: 'Fathima Beevi',
    age: 46,
    sex: 'Female',
    phone: '+91 98950 11223',
    allergies: ['NSAIDs / Aspirin'],
    pastHistory: 'Pregnancy (2 children). No chronic hypertension. History of severe menstrual cramps.',
    registeredAt: '2026-10-25T08:30:00',
  },
  {
    id: 'pat-005',
    mrn: 'PJ-000005',
    name: 'Suresh Babu',
    age: 39,
    sex: 'Male',
    phone: '+91 94460 33445',
    allergies: [],
    pastHistory: 'No significant past medical history. Appendectomy (2018).',
    registeredAt: '2026-10-25T08:45:00',
  },
  {
    id: 'pat-006',
    mrn: 'PJ-000006',
    name: 'Anjali Menon',
    age: 7,
    sex: 'Female',
    phone: '+91 97455 66778',
    allergies: [],
    pastHistory: 'Well-child checkups only. No chronic illnesses.',
    registeredAt: '2026-10-25T09:00:00',
  },
  ...[
    ['dummy-01', 'PJ-000007', 'Aarav Nair', 34, 'Male', '+91 98460 10007', 0],
    ['dummy-02', 'PJ-000008', 'Devika Ramesh', 29, 'Female', '+91 98460 10008', 1],
    ['dummy-03', 'PJ-000009', 'Joseph Varghese', 52, 'Male', '+91 98460 10009', 2],
    ['dummy-04', 'PJ-000010', 'Meera Krishnan', 41, 'Female', '+91 98460 10010', 3],
    ['dummy-05', 'PJ-000011', 'Rohan Mathew', 16, 'Male', '+91 98460 10011', 4],
    ['dummy-06', 'PJ-000012', 'Lakshmi Devi', 61, 'Female', '+91 98460 10012', 5],
    ['dummy-07', 'PJ-000013', 'Anand Pillai', 38, 'Male', '+91 98460 10013', 5],
    ['dummy-08', 'PJ-000014', 'Sarah George', 27, 'Female', '+91 98460 10014', 0],
    ['dummy-09', 'PJ-000015', 'Vishnu Kumar', 45, 'Male', '+91 98460 10015', 1],
    ['dummy-10', 'PJ-000016', 'Nandana Raj', 12, 'Female', '+91 98460 10016', 2],
    ['dummy-11', 'PJ-000017', 'Thomas Abraham', 67, 'Male', '+91 98460 10017', 3],
    ['dummy-12', 'PJ-000018', 'Isha Mohan', 24, 'Female', '+91 98460 10018', 4],
    ['dummy-13', 'PJ-000019', 'Arjun Das', 55, 'Male', '+91 98460 10019', 5],
    ['dummy-14', 'PJ-000020', 'Sneha Philip', 36, 'Female', '+91 98460 10020', 0],
    ['dummy-15', 'PJ-000021', 'Samuel Jacob', 19, 'Male', '+91 98460 10021', 1],
  ].map(([id, mrn, name, age, sex, phone, doctorIndex], index) => ({
    id: String(id),
    mrn: String(mrn),
    name: String(name),
    age: Number(age),
    sex: String(sex) as 'Male' | 'Female' | 'Other',
    phone: String(phone),
    allergies: [],
    pastHistory: doctorIndex === 0 ? 'Healthy, occasional viral infections.' : doctorIndex === 1 ? 'Seasonal allergies, no chronic conditions.' : doctorIndex === 2 ? 'Hypertension managed with lifestyle.' : doctorIndex === 3 ? 'Migraine (2–3 times/year), no medication use.' : doctorIndex === 4 ? 'Hyperthyroidism (on medication), regular follow-up.' : 'No significant chronic illnesses.',
    registeredAt: `2026-10-25T09:${String(25 + index).padStart(2, '0')}:00`,
  })),
];

export const INITIAL_SHIFTS: ShiftRecord[] = [
  {
    id: 'shift-rec-a',
    department: 'reception',
    shiftType: 'Shift A',
    cashierName: 'Cashier 1 (placeholder)',
    status: 'open',
    openedAt: '2026-10-25T08:00:00',
    openingCash: 2000,
  },
  {
    id: 'shift-phm-a',
    department: 'pharmacy',
    shiftType: 'Shift A',
    cashierName: 'Pharmacist 1 (placeholder)',
    status: 'open',
    openedAt: '2026-10-25T08:00:00',
    openingCash: 1500,
  }
];

export const INITIAL_VISITS: TokenVisit[] = [
  // Past completed visit for K. V. Narayanan to demonstrate rich visit history
  {
    id: 'vis-past-01',
    tokenNumber: 'D1-098',
    patientId: 'pat-001',
    doctorId: 'doc-1',
    reason: 'Fever and throat irritation (Past Visit)',
    fee: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-18T10:15:00',
    status: 'completed',
    assignedRoom: 'Room 1',
    calledAt: '2026-10-18T10:30:00',
    completedAt: '2026-10-18T11:00:00',
    consultationReceiptNo: 'REC-2026-0000',
    pharmacyBillId: 'PHM-2026-0000',
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-18T10:15:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'completed', timestamp: '2026-10-18T11:00:00', actorName: 'Pharmacist 1 (placeholder)', actorRole: 'Pharmacist' }
    ],
    caseSheet: {
      chiefComplaint: 'Mild fever and dry cough for 2 days.',
      history: 'Seasonal change. No known comorbidities.',
      pastHistory: 'No known chronic illnesses. No previous surgeries.',
      vitals: { bp: '128/82', pulse: '78', temp: '99.0', spo2: '98', weight: '70', respiratoryRate: '18' },
      examination: 'Mild pharyngeal erythema. Chest clear.',
      diagnosis: 'Acute Viral Pharyngitis',
      plan: 'Warm gargles, antipyretics.',
      savedAt: '2026-10-18T10:45:00'
    },
    prescriptions: [
      {
        drugId: 'd-01',
        drugName: 'Dolo 650',
        strength: '650mg',
        form: 'Tablet',
        dose: '1 tab',
        frequency: 'TDS',
        duration: '3 days',
        instructions: 'After food',
        isOutsideMedicine: false,
        unitPrice: 32,
        qtyToDispense: 10,
        qtyDispensed: 10,
        dispensed: true,
        dispensedAt: '2026-10-18T10:55:00',
        dispensedBy: 'Pharmacist 1 (placeholder)',
        dispensedBatchNumber: 'DL-24K09',
        dispensedBatchExpiry: '2026-11-10'
      }
    ],
    procedureOrders: []
  },

  // Today's Active Visits
  {
    id: 'vis-001',
    tokenNumber: 'D1-001',
    patientId: 'pat-001',
    doctorId: 'doc-1',
    reason: 'Severe body ache, mild fever, throat pain',
    fee: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T08:45:00',
    status: 'with_doctor', // Currently inside Room 1 with Doctor 1
    assignedRoom: 'Room 1',
    calledAt: '2026-10-25T09:15:00',
    consultationReceiptNo: 'REC-2026-0001',
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-25T08:45:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'waiting_doctor', timestamp: '2026-10-25T08:46:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'with_doctor', timestamp: '2026-10-25T09:15:00', actorName: 'Doctor 1 (placeholder)', actorRole: 'Doctor', notes: 'Called into Room 1' }
    ],
    caseSheet: {
      chiefComplaint: 'Fever, sore throat and myalgia for 2 days.',
      history: 'Onset 48 hrs ago after travel. No chills or rigors. No breathing difficulty.',
      pastHistory: 'No known chronic illnesses. Occasional seasonal allergies.',
      vitals: { bp: '130/84', pulse: '82', temp: '99.4', spo2: '98', weight: '71', respiratoryRate: '20' },
      examination: 'Congested posterior pharyngeal wall. Bilateral tonsils mild erythema.',
      diagnosis: 'Acute Pharyngitis & Viral Fever',
      plan: 'Paracetamol, antiallergic, warm salt gargle.',
      savedAt: '2026-10-25T09:20:00'
    },
    prescriptions: [
      {
        drugId: 'd-01',
        drugName: 'Dolo 650',
        strength: '650mg',
        form: 'Tablet',
        dose: '1 tab',
        frequency: 'TDS',
        duration: '3 days',
        instructions: 'After food',
        isOutsideMedicine: false,
        unitPrice: 32,
        qtyToDispense: 10,
        qtyDispensed: 0,
        dispensed: false
      }
    ],
    procedureOrders: []
  },
  {
    id: 'vis-002',
    tokenNumber: 'D1-002',
    patientId: 'pat-004',
    doctorId: 'doc-1',
    reason: 'Vomiting, abdominal cramps, diarrhea',
    fee: 300,
    paymentMethod: 'upi',
    upiRef: 'UPI/382947192837',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T08:50:00',
    status: 'procedure_billing_pending', // Doctor has consulted and ordered IV fluids + Injection; needs reception to bill procedures
    assignedRoom: 'Room 1',
    calledAt: '2026-10-25T09:00:00',
    consultationReceiptNo: 'REC-2026-0002',
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-25T08:50:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'waiting_doctor', timestamp: '2026-10-25T08:51:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'with_doctor', timestamp: '2026-10-25T09:00:00', actorName: 'Doctor 1 (placeholder)', actorRole: 'Doctor' },
      { stage: 'procedure_billing_pending', timestamp: '2026-10-25T09:12:00', actorName: 'Doctor 1 (placeholder)', actorRole: 'Doctor', notes: 'Prescribed IV fluids and antiemetic' }
    ],
    caseSheet: {
      chiefComplaint: 'Vomiting 4 times, watery loose stools 3 times since early morning.',
      history: 'Severe weakness and dehydration signs. Ate restaurant food last evening.',
      pastHistory: 'No significant past medical history. No known allergies.',
      vitals: { bp: '100/70', pulse: '96', temp: '98.6', spo2: '99', weight: '54', respiratoryRate: '16' },
      examination: 'Mild postural tachycardia. Dry oral mucosa. Periumbilical tenderness.',
      diagnosis: 'Acute Gastroenteritis with moderate dehydration',
      plan: 'Start IV NS 500ml stat, IV Ondansetron injection. Oral ORS once vomiting subsides.',
      savedAt: '2026-10-25T09:12:00'
    },
    prescriptions: [
      {
        drugId: 'd-10',
        drugName: 'Electral Sachet',
        strength: '21.8g',
        form: 'Sachet',
        dose: '1 sachet in 1L water',
        frequency: 'Frequent sips',
        duration: '2 days',
        instructions: 'Sip gradually',
        isOutsideMedicine: false,
        unitPrice: 22,
        qtyToDispense: 3,
        qtyDispensed: 0,
        dispensed: false
      }
    ],
    procedureOrders: [
      {
        procedureId: 'proc-01',
        name: 'IV Fluid Infusion (Normal Saline 500ml)',
        unitPrice: 250,
        qty: 1,
        totalPrice: 250,
        notes: 'Infuse over 45 minutes',
        status: 'UNBILLED',
        billed: false,
        nurseGiven: false
      },
      {
        procedureId: 'proc-03',
        name: 'IM/IV Injection Administration',
        unitPrice: 80,
        qty: 1,
        totalPrice: 80,
        notes: 'Administer Ondansetron 4mg IV slowly',
        status: 'UNBILLED',
        billed: false,
        nurseGiven: false
      }
    ]
  },
  {
    id: 'vis-003',
    tokenNumber: 'D2-001',
    patientId: 'pat-006',
    doctorId: 'doc-2',
    reason: 'Wheezing and nighttime dry cough',
    fee: 300,
    paymentMethod: 'card',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:05:00',
    status: 'nurse_check_pending', // Billed at reception, now ready for nurse nebulisation!
    assignedRoom: 'Room 2',
    calledAt: '2026-10-25T09:10:00',
    consultationReceiptNo: 'REC-2026-0003',
    procedureBillId: 'REC-2026-0004',
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-25T09:05:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'waiting_doctor', timestamp: '2026-10-25T09:06:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'with_doctor', timestamp: '2026-10-25T09:10:00', actorName: 'Doctor 2 (placeholder)', actorRole: 'Doctor' },
      { stage: 'procedure_billing_pending', timestamp: '2026-10-25T09:20:00', actorName: 'Doctor 2 (placeholder)', actorRole: 'Doctor' },
      { stage: 'nurse_check_pending', timestamp: '2026-10-25T09:24:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist', notes: 'Procedure bill paid' }
    ],
    caseSheet: {
      chiefComplaint: 'Bilateral wheezing, persistent dry cough worsening at night.',
      history: 'History of allergic bronchitis. Triggered by recent dust exposure.',
      pastHistory: 'Asthma since childhood. No smoking history.',
      vitals: { bp: '100/68', pulse: '92', temp: '98.4', spo2: '96', weight: '22', respiratoryRate: '22' },
      examination: 'Bilateral expiratory wheezing on chest auscultation. No subcostal retractions.',
      diagnosis: 'Acute Bronchospasm / Mild Asthmatic Exacerbation',
      plan: 'Stat Nebulisation with Salbutamol and Budecort. Review breath sounds after 20 mins.',
      savedAt: '2026-10-25T09:20:00'
    },
    prescriptions: [
      {
        drugId: 'd-08',
        drugName: 'Montair LC',
        strength: '10mg/5mg',
        form: 'Tablet',
        dose: '1/2 tab',
        frequency: 'OD at night',
        duration: '7 days',
        instructions: 'Take after dinner',
        isOutsideMedicine: false,
        unitPrice: 160,
        qtyToDispense: 4,
        qtyDispensed: 0,
        dispensed: false
      }
    ],
    procedureOrders: [
      {
        procedureId: 'proc-05',
        name: 'Nebulisation with Salbutamol',
        unitPrice: 150,
        qty: 1,
        totalPrice: 150,
        notes: 'Stat dose with 2.5ml saline',
        status: 'BILLED',
        billed: true,
        billInvoiceNo: 'REC-2026-0004',
        nurseGiven: false
      }
    ]
  },
  {
    id: 'vis-004',
    tokenNumber: 'D1-003',
    patientId: 'pat-005',
    doctorId: 'doc-1',
    reason: 'Follow up Type 2 Diabetes & check blood sugar',
    fee: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:10:00',
    status: 'waiting_doctor', // Waiting in Doctor 1's queue
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-25T09:10:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'waiting_doctor', timestamp: '2026-10-25T09:11:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' }
    ],
    prescriptions: [],
    procedureOrders: [],
    consultationReceiptNo: 'REC-2026-0005'
  },
  {
    id: 'vis-005',
    tokenNumber: 'D2-002',
    patientId: 'pat-003',
    doctorId: 'doc-2',
    reason: 'Child routine immunization and growth check',
    fee: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:20:00',
    status: 'waiting_doctor', // Waiting in Doctor 2's queue
    stageHistory: [
      { stage: 'registered_token_paid', timestamp: '2026-10-25T09:20:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
      { stage: 'waiting_doctor', timestamp: '2026-10-25T09:21:00', actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' }
    ],
    prescriptions: [],
    procedureOrders: [],
    consultationReceiptNo: 'REC-2026-0006'
  },
  ...Array.from({ length: 9 }, (_, index) => {
    const patients = [
      ['dummy-01', 'D1-101'],
      ['dummy-04', 'D1-102'],
      ['dummy-07', 'D1-103'],
    ];
    const patientIndex = Math.floor(index / 3);
    const visitIndex = index % 3;
    const [patientId, currentToken] = patients[patientIndex];
    const visitNumber = 90 + patientIndex * 10 + (3 - visitIndex);
    const daysAgo = [21, 42, 63][visitIndex];
    const records = [
      ['Upper respiratory infection', 'Dry cough and throat pain for 4 days.', 'Seasonal viral symptoms. No persistent fever.', 'Mild pharyngeal congestion. Chest clear.', 'Acute viral upper respiratory infection', 'Steam inhalation, hydration, review if fever persists.'],
      ['Generalized weakness and fever', 'Intermittent fever and body ache.', 'Symptoms improved with previous treatment. No current cough.', 'Vitals stable. Systemic examination normal.', 'Follow-up viral fever', 'Continue hydration and symptomatic treatment. Review in one week.'],
      ['Routine follow-up', 'Review of symptoms and general health.', 'No new illness since the previous visit.', 'General examination within normal limits.', 'Recovered / routine follow-up', 'Continue current plan and return if symptoms recur.'],
    ];
    const [reason, complaint, history, examination, diagnosis, plan] = records[visitIndex];
    const timestamp = new Date(Date.UTC(2026, 9, 1 + visitNumber, 9, 15 + visitIndex)).toISOString().slice(0, 19);
    return {
      id: `vis-dummy-history-${patientId}-${visitIndex + 1}`,
      tokenNumber: `${currentToken}-H${3 - visitIndex}`,
      patientId,
      doctorId: 'doc-1' as const,
      reason,
      fee: 300,
      paymentMethod: 'cash' as const,
      cashierName: 'Cashier 1 (placeholder)',
      shift: 'Shift A' as const,
      timestamp,
      status: 'completed' as const,
      assignedRoom: 'Room 1',
      calledAt: timestamp.replace('T09:', 'T09:20:'),
      completedAt: timestamp.replace('T09:', 'T09:45:'),
      consultationReceiptNo: `REC-HIST-${patientIndex}-${visitIndex}`,
      stageHistory: [
        { stage: 'registered_token_paid' as const, timestamp, actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
        { stage: 'completed' as const, timestamp: timestamp.replace('T09:', 'T09:45:'), actorName: 'Doctor 1 (placeholder)', actorRole: 'Doctor' },
      ],
      caseSheet: {
        chiefComplaint: complaint,
        history,
        pastHistory: 'No significant past medical history.',
        vitals: { bp: ['118/76', '120/80', '122/78'][visitIndex], pulse: ['76', '78', '74'][visitIndex], temp: ['98.6', '98.8', '98.4'][visitIndex], spo2: ['99', '98', '99'][visitIndex], weight: ['68', '68', '69'][visitIndex], respiratoryRate: ['14', '16', '18'][visitIndex] },
        examination,
        diagnosis,
        plan,
      },
      prescriptions: [],
      procedureOrders: [],
      labOrders: [],
    };
  }),
  ...Array.from({ length: 15 }, (_, index) => {
    const doctorIndex = index % 3;
    const doctorId = `doc-${doctorIndex + 1}` as 'doc-1' | 'doc-2' | 'doc-3';
    const prefix = `D${doctorIndex + 1}`;
    const tokenNumber = `${prefix}-${String(101 + Math.floor(index / 3)).padStart(3, '0')}`;
    const patientNumber = index + 7;
    const timestamp = `2026-10-25T09:${String(25 + index).padStart(2, '0')}:00`;
    return {
      id: `vis-dummy-${String(index + 1).padStart(2, '0')}`,
      tokenNumber,
      patientId: `dummy-${String(index + 1).padStart(2, '0')}`,
      doctorId,
      reason: ['Routine consultation', 'Follow-up review', 'General health check', 'Medication review', 'New symptom assessment'][index % 5],
      fee: 300,
      paymentMethod: (['cash', 'upi', 'card'] as const)[index % 3],
      cashierName: 'Cashier 1 (placeholder)',
      shift: 'Shift A' as const,
      timestamp,
      status: 'waiting_doctor' as const,
      stageHistory: [
        { stage: 'registered_token_paid' as const, timestamp, actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' },
        { stage: 'waiting_doctor' as const, timestamp, actorName: 'Cashier 1 (placeholder)', actorRole: 'Receptionist' }
      ],
      prescriptions: [],
      procedureOrders: [],
      consultationReceiptNo: `REC-2026-${String(10 + index).padStart(4, '0')}`
    };
  })
];

export const INITIAL_BILLS: Bill[] = [
  {
    id: 'bill-000',
    invoiceNo: 'REC-2026-0000',
    type: 'consultation',
    visitId: 'vis-past-01',
    patientId: 'pat-001',
    patientName: 'K. V. Narayanan',
    patientMrn: 'PJ-000001',
    items: [
      { name: 'Doctor 1 (placeholder) - Consultation Fee', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-18T10:15:00',
    status: 'paid'
  },
  {
    id: 'bill-phm-000',
    invoiceNo: 'PHM-2026-0000',
    type: 'pharmacy',
    visitId: 'vis-past-01',
    patientId: 'pat-001',
    patientName: 'K. V. Narayanan',
    patientMrn: 'PJ-000001',
    items: [
      { name: 'Dolo 650 (650mg) [Batch DL-24K09]', qty: 10, unitPrice: 32, total: 320 }
    ],
    subtotal: 320,
    tax: 0,
    total: 320,
    paymentMethod: 'cash',
    cashierName: 'Pharmacist 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-18T10:58:00',
    status: 'paid'
  },
  {
    id: 'bill-001',
    invoiceNo: 'REC-2026-0001',
    type: 'consultation',
    visitId: 'vis-001',
    patientId: 'pat-001',
    patientName: 'K. V. Narayanan',
    patientMrn: 'PJ-000001',
    items: [
      { name: 'Doctor 1 (placeholder) - Consultation Fee (Token D1-001)', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T08:45:00',
    status: 'paid'
  },
  {
    id: 'bill-002',
    invoiceNo: 'REC-2026-0002',
    type: 'consultation',
    visitId: 'vis-002',
    patientId: 'pat-004',
    patientName: 'Fathima Beevi',
    patientMrn: 'PJ-000004',
    items: [
      { name: 'Doctor 1 (placeholder) - Consultation Fee (Token D1-002)', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'upi',
    upiRef: 'UPI/382947192837',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T08:50:00',
    status: 'paid'
  },
  {
    id: 'bill-003',
    invoiceNo: 'REC-2026-0003',
    type: 'consultation',
    visitId: 'vis-003',
    patientId: 'pat-006',
    patientName: 'Anjali Menon',
    patientMrn: 'PJ-000006',
    items: [
      { name: 'Doctor 2 (placeholder) - Consultation Fee (Token D2-001)', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'card',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:05:00',
    status: 'paid'
  },
  {
    id: 'bill-004',
    invoiceNo: 'REC-2026-0004',
    type: 'procedure',
    visitId: 'vis-003',
    patientId: 'pat-006',
    patientName: 'Anjali Menon',
    patientMrn: 'PJ-000006',
    items: [
      { name: 'Nebulisation with Salbutamol', qty: 1, unitPrice: 150, total: 150 }
    ],
    subtotal: 150,
    tax: 0,
    total: 150,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:24:00',
    status: 'paid'
  },
  {
    id: 'bill-005',
    invoiceNo: 'REC-2026-0005',
    type: 'consultation',
    visitId: 'vis-004',
    patientId: 'pat-005',
    patientName: 'Suresh Babu',
    patientMrn: 'PJ-000005',
    items: [
      { name: 'Doctor 1 (placeholder) - Consultation Fee (Token D1-003)', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:10:00',
    status: 'paid'
  },
  {
    id: 'bill-006',
    invoiceNo: 'REC-2026-0006',
    type: 'consultation',
    visitId: 'vis-005',
    patientId: 'pat-003',
    patientName: 'Priya Anilkumar',
    patientMrn: 'PJ-000003',
    items: [
      { name: 'Doctor 2 (placeholder) - Consultation Fee (Token D2-002)', qty: 1, unitPrice: 300, total: 300 }
    ],
    subtotal: 300,
    tax: 0,
    total: 300,
    paymentMethod: 'cash',
    cashierName: 'Cashier 1 (placeholder)',
    shift: 'Shift A',
    timestamp: '2026-10-25T09:20:00',
    status: 'paid'
  },
  ...Array.from({ length: 15 }, (_, index) => {
    const names = ['Aarav Nair', 'Devika Ramesh', 'Joseph Varghese', 'Meera Krishnan', 'Rohan Mathew', 'Lakshmi Devi', 'Anand Pillai', 'Sarah George', 'Vishnu Kumar', 'Nandana Raj', 'Thomas Abraham', 'Isha Mohan', 'Arjun Das', 'Sneha Philip', 'Samuel Jacob'];
    const doctorIndex = index % 3;
    return {
      id: `bill-dummy-${String(index + 1).padStart(2, '0')}`,
      invoiceNo: `REC-2026-${String(10 + index).padStart(4, '0')}`,
      type: 'consultation' as const,
      visitId: `vis-dummy-${String(index + 1).padStart(2, '0')}`,
      patientId: `dummy-${String(index + 1).padStart(2, '0')}`,
      patientName: names[index],
      patientMrn: `PJ-${String(index + 7).padStart(6, '0')}`,
      items: [{ name: `Doctor ${doctorIndex + 1} (placeholder) - Consultation Fee`, qty: 1, unitPrice: 300, total: 300 }],
      subtotal: 300,
      tax: 0,
      total: 300,
      paymentMethod: (['cash', 'upi', 'card'] as const)[index % 3],
      cashierName: 'Cashier 1 (placeholder)',
      shift: 'Shift A' as const,
      timestamp: `2026-10-25T09:${String(25 + index).padStart(2, '0')}:00`,
      status: 'paid' as const
    };
  })
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'log-001',
    timestamp: '2026-10-25T08:00:00',
    role: 'RECEPTIONIST',
    userName: 'Cashier 1 (placeholder)',
    action: 'SHIFT_OPENED',
    targetEntity: 'Shift: Reception Shift A',
    afterValue: { openingCash: 2000, shift: 'Shift A' },
    details: 'Opened morning reception shift with ₹2,000 opening cash drawer.'
  },
  {
    id: 'log-002',
    timestamp: '2026-10-25T08:00:00',
    role: 'PHARMACIST',
    userName: 'Pharmacist 1 (placeholder)',
    action: 'SHIFT_OPENED',
    targetEntity: 'Shift: Pharmacy Shift A',
    afterValue: { openingCash: 1500, shift: 'Shift A' },
    details: 'Opened morning pharmacy counter shift with ₹1,500 float.'
  },
  {
    id: 'log-003',
    timestamp: '2026-10-25T08:45:00',
    role: 'RECEPTIONIST',
    userName: 'Cashier 1 (placeholder)',
    action: 'TOKEN_CREATED',
    targetEntity: 'Token: D1-001',
    patientMrn: 'PJ-000001',
    afterValue: { token: 'D1-001', patient: 'K. V. Narayanan (PJ-000001)', doctor: 'Doctor 1 (placeholder)', fee: 300, mode: 'cash' },
    details: 'Consultation fee ₹300 received in Cash. Token D1-001 issued for Doctor 1 (placeholder).'
  },
  {
    id: 'log-004',
    timestamp: '2026-10-25T09:15:00',
    role: 'DOCTOR',
    userName: 'Doctor 1 (placeholder)',
    action: 'TOKEN_CALLED',
    targetEntity: 'Token: D1-001',
    patientMrn: 'PJ-000001',
    beforeValue: { stage: 'waiting_doctor' },
    afterValue: { stage: 'with_doctor', room: 'Room 1' },
    details: 'Doctor 1 (placeholder) called token D1-001 into free consultation Room 1.'
  },
  {
    id: 'log-005',
    timestamp: '2026-10-25T09:12:00',
    role: 'DOCTOR',
    userName: 'Doctor 1 (placeholder)',
    action: 'ORDER_PROCEDURE',
    targetEntity: 'Procedure Orders: Token D1-002',
    patientMrn: 'PJ-000004',
    beforeValue: null,
    afterValue: { status: 'UNBILLED', items: ['IV Fluid Infusion (Normal Saline 500ml)', 'IM/IV Injection Administration'] },
    details: 'Doctor 1 prescribed 2 procedure orders for Fathima Beevi. Status: UNBILLED.'
  },
  {
    id: 'log-006',
    timestamp: '2026-10-25T09:20:00',
    role: 'DOCTOR',
    userName: 'Doctor 2 (placeholder)',
    action: 'ORDER_PROCEDURE',
    targetEntity: 'Procedure Order: Token D2-001',
    patientMrn: 'PJ-000006',
    beforeValue: null,
    afterValue: { status: 'UNBILLED', item: 'Nebulisation with Salbutamol' },
    details: 'Doctor 2 prescribed Nebulisation with Salbutamol for Anjali Menon. Status: UNBILLED.'
  },
  {
    id: 'log-007',
    timestamp: '2026-10-25T09:24:00',
    role: 'RECEPTIONIST',
    userName: 'Cashier 1 (placeholder)',
    action: 'BILL_PROCEDURE_ORDER',
    targetEntity: 'Procedure Order: Nebulisation with Salbutamol (Token D2-001)',
    patientMrn: 'PJ-000006',
    beforeValue: { status: 'UNBILLED' },
    afterValue: { status: 'BILLED', billInvoiceNo: 'REC-2026-0004' },
    details: 'Order "Nebulisation with Salbutamol" status changed from UNBILLED to BILLED. Invoice: REC-2026-0004.'
  }
];
