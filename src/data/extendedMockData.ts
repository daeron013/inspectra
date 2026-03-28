export interface SupplierDetail {
  id: string;
  name: string;
  status: 'approved' | 'conditional' | 'at-risk' | 'disqualified';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastAudit: string;
  nextRequalification: string;
  defectRate: number;
  partsSupplied: number;
  openNCRs: number;
  certifications: { name: string; issueDate: string; expiryDate: string; status: 'valid' | 'expiring' | 'expired' }[];
  fdaRegistration: string;
  country: string;
  contactEmail: string;
}

export interface Part {
  id: string;
  name: string;
  partNumber: string;
  supplierId: string;
  supplierName: string;
  fdaApproved: boolean;
  fdaClearance: string;
  riskClass: 'I' | 'II' | 'III';
  category: string;
  currentLots: LotRecord[];
  specifications: string;
}

export interface LotRecord {
  lotNumber: string;
  receivedDate: string;
  expiryDate: string;
  quantity: number;
  status: 'active' | 'quarantined' | 'expired' | 'recalled' | 'consumed';
  inspectionStatus: 'passed' | 'failed' | 'pending';
  supplierId: string;
}

export interface Device {
  id: string;
  name: string;
  modelNumber: string;
  serialRange: string;
  fdaClass: 'I' | 'II' | 'III';
  status: 'production' | 'released' | 'recalled' | 'discontinued';
  lotComponents: { partId: string; partName: string; lotNumber: string; supplierId: string }[];
  unitsProduced: number;
  recallStatus: 'none' | 'partial' | 'full';
}

export interface DocumentUpload {
  id: string;
  fileName: string;
  type: 'supplier_certificate' | 'inspection_sheet' | 'batch_record' | 'ncr_note' | 'sop_spec';
  uploadedAt: string;
  status: 'processing' | 'extracted' | 'linked' | 'flagged';
  extractedData?: Record<string, string>;
  linkedRecords?: string[];
  flags?: string[];
}

export const suppliersDetailed: SupplierDetail[] = [
  {
    id: 'S-112', name: 'MedTech Components Ltd', status: 'at-risk', riskLevel: 'critical',
    lastAudit: '2024-09-15', nextRequalification: '2024-12-15', defectRate: 6.2, partsSupplied: 12400, openNCRs: 3,
    certifications: [
      { name: 'ISO 13485:2016', issueDate: '2022-03-01', expiryDate: '2025-03-01', status: 'valid' },
      { name: 'ISO 9001:2015', issueDate: '2021-06-15', expiryDate: '2024-06-15', status: 'expired' },
      { name: 'FDA 21 CFR 820', issueDate: '2023-01-10', expiryDate: '2026-01-10', status: 'valid' },
    ],
    fdaRegistration: 'FEI-3012847', country: 'United States', contactEmail: 'quality@medtechcomp.com',
  },
  {
    id: 'S-203', name: 'PrecisionMed Plastics', status: 'conditional', riskLevel: 'high',
    lastAudit: '2024-11-01', nextRequalification: '2025-02-01', defectRate: 3.1, partsSupplied: 8200, openNCRs: 2,
    certifications: [
      { name: 'ISO 13485:2016', issueDate: '2023-05-20', expiryDate: '2026-05-20', status: 'valid' },
      { name: 'FDA 21 CFR 820', issueDate: '2023-08-01', expiryDate: '2026-08-01', status: 'valid' },
    ],
    fdaRegistration: 'FEI-3045192', country: 'United States', contactEmail: 'qa@precisionmed.com',
  },
  {
    id: 'S-087', name: 'BioSafe Packaging Corp', status: 'approved', riskLevel: 'low',
    lastAudit: '2024-10-20', nextRequalification: '2025-01-20', defectRate: 0.4, partsSupplied: 45000, openNCRs: 0,
    certifications: [
      { name: 'ISO 13485:2016', issueDate: '2023-02-01', expiryDate: '2026-02-01', status: 'valid' },
      { name: 'ISO 14644 Cleanroom', issueDate: '2024-01-15', expiryDate: '2025-01-15', status: 'expiring' },
    ],
    fdaRegistration: 'FEI-3089561', country: 'United States', contactEmail: 'compliance@biosafe.com',
  },
  {
    id: 'S-156', name: 'TitanAlloy Medical', status: 'approved', riskLevel: 'low',
    lastAudit: '2024-11-10', nextRequalification: '2025-02-10', defectRate: 0.8, partsSupplied: 5600, openNCRs: 0,
    certifications: [
      { name: 'ISO 13485:2016', issueDate: '2022-09-01', expiryDate: '2025-09-01', status: 'valid' },
      { name: 'ASTM F136', issueDate: '2024-03-01', expiryDate: '2027-03-01', status: 'valid' },
    ],
    fdaRegistration: 'FEI-3067234', country: 'Germany', contactEmail: 'qa@titanalloy.de',
  },
  {
    id: 'S-301', name: 'SterileTech Solutions', status: 'conditional', riskLevel: 'medium',
    lastAudit: '2024-08-05', nextRequalification: '2024-11-05', defectRate: 2.1, partsSupplied: 15300, openNCRs: 1,
    certifications: [
      { name: 'ISO 13485:2016', issueDate: '2023-07-01', expiryDate: '2026-07-01', status: 'valid' },
      { name: 'ISO 11135 EO Sterilization', issueDate: '2023-04-01', expiryDate: '2024-10-01', status: 'expired' },
    ],
    fdaRegistration: 'FEI-3091445', country: 'United States', contactEmail: 'quality@steriletech.com',
  },
];

export const parts: Part[] = [
  {
    id: 'P-001', name: 'Titanium Hip Stem', partNumber: 'THS-4420',
    supplierId: 'S-156', supplierName: 'TitanAlloy Medical',
    fdaApproved: true, fdaClearance: '510(k) K192847', riskClass: 'III', category: 'Implant Component',
    specifications: 'Ti-6Al-4V ELI, ASTM F136, Surface Ra ≤ 0.8μm',
    currentLots: [
      { lotNumber: 'THS-2024-0891', receivedDate: '2024-11-01', expiryDate: '2029-11-01', quantity: 200, status: 'active', inspectionStatus: 'passed', supplierId: 'S-156' },
      { lotNumber: 'THS-2024-0742', receivedDate: '2024-09-15', expiryDate: '2029-09-15', quantity: 45, status: 'active', inspectionStatus: 'passed', supplierId: 'S-156' },
    ],
  },
  {
    id: 'P-002', name: 'UHMWPE Liner', partNumber: 'UPE-3310',
    supplierId: 'S-203', supplierName: 'PrecisionMed Plastics',
    fdaApproved: true, fdaClearance: '510(k) K201534', riskClass: 'III', category: 'Implant Component',
    specifications: 'GUR 1020, Crosslinked, ASTM F648',
    currentLots: [
      { lotNumber: 'UPE-2024-1102', receivedDate: '2024-12-01', expiryDate: '2027-12-01', quantity: 500, status: 'active', inspectionStatus: 'passed', supplierId: 'S-203' },
      { lotNumber: 'UPE-2024-0998', receivedDate: '2024-10-20', expiryDate: '2027-10-20', quantity: 120, status: 'quarantined', inspectionStatus: 'failed', supplierId: 'S-203' },
    ],
  },
  {
    id: 'P-003', name: 'Sterile Barrier Pouch', partNumber: 'SBP-7700',
    supplierId: 'S-087', supplierName: 'BioSafe Packaging Corp',
    fdaApproved: true, fdaClearance: '510(k) K183921', riskClass: 'I', category: 'Packaging',
    specifications: 'Tyvek/PET laminate, ISO 11607-1 compliant',
    currentLots: [
      { lotNumber: 'SBP-2024-4521', receivedDate: '2024-12-10', expiryDate: '2026-12-10', quantity: 10000, status: 'active', inspectionStatus: 'passed', supplierId: 'S-087' },
    ],
  },
  {
    id: 'P-004', name: 'Surgical Screw (Cortical)', partNumber: 'SCS-2250',
    supplierId: 'S-112', supplierName: 'MedTech Components Ltd',
    fdaApproved: true, fdaClearance: '510(k) K211003', riskClass: 'II', category: 'Fixation Hardware',
    specifications: 'Ti-6Al-4V, 3.5mm × 28mm, Self-tapping',
    currentLots: [
      { lotNumber: 'SCS-2024-3301', receivedDate: '2024-11-15', expiryDate: '2029-11-15', quantity: 1000, status: 'active', inspectionStatus: 'passed', supplierId: 'S-112' },
      { lotNumber: 'SCS-2024-3188', receivedDate: '2024-10-01', expiryDate: '2029-10-01', quantity: 300, status: 'quarantined', inspectionStatus: 'failed', supplierId: 'S-112' },
      { lotNumber: 'SCS-2024-2901', receivedDate: '2024-08-20', expiryDate: '2029-08-20', quantity: 0, status: 'recalled', inspectionStatus: 'passed', supplierId: 'S-112' },
    ],
  },
  {
    id: 'P-005', name: 'Sterilization Indicator Strip', partNumber: 'SIS-1100',
    supplierId: 'S-301', supplierName: 'SterileTech Solutions',
    fdaApproved: true, fdaClearance: '510(k) K195220', riskClass: 'I', category: 'Sterilization',
    specifications: 'EO Chemical Indicator, ISO 11140-1 Type 5',
    currentLots: [
      { lotNumber: 'SIS-2024-8800', receivedDate: '2024-11-20', expiryDate: '2025-05-20', quantity: 5000, status: 'active', inspectionStatus: 'passed', supplierId: 'S-301' },
      { lotNumber: 'SIS-2024-7701', receivedDate: '2024-06-01', expiryDate: '2024-12-01', quantity: 200, status: 'expired', inspectionStatus: 'passed', supplierId: 'S-301' },
    ],
  },
];

export const devices: Device[] = [
  {
    id: 'DEV-001', name: 'OrthoFlex Total Hip System', modelNumber: 'OF-THS-500',
    serialRange: 'OF500-10001 to OF500-10450', fdaClass: 'III',
    status: 'production', unitsProduced: 450, recallStatus: 'none',
    lotComponents: [
      { partId: 'P-001', partName: 'Titanium Hip Stem', lotNumber: 'THS-2024-0891', supplierId: 'S-156' },
      { partId: 'P-002', partName: 'UHMWPE Liner', lotNumber: 'UPE-2024-1102', supplierId: 'S-203' },
      { partId: 'P-003', partName: 'Sterile Barrier Pouch', lotNumber: 'SBP-2024-4521', supplierId: 'S-087' },
      { partId: 'P-005', partName: 'Sterilization Indicator Strip', lotNumber: 'SIS-2024-8800', supplierId: 'S-301' },
    ],
  },
  {
    id: 'DEV-002', name: 'OrthoFlex Fracture Plate Kit', modelNumber: 'OF-FPK-300',
    serialRange: 'OF300-20001 to OF300-20280', fdaClass: 'II',
    status: 'released', unitsProduced: 280, recallStatus: 'partial',
    lotComponents: [
      { partId: 'P-004', partName: 'Surgical Screw (Cortical)', lotNumber: 'SCS-2024-2901', supplierId: 'S-112' },
      { partId: 'P-003', partName: 'Sterile Barrier Pouch', lotNumber: 'SBP-2024-4521', supplierId: 'S-087' },
      { partId: 'P-005', partName: 'Sterilization Indicator Strip', lotNumber: 'SIS-2024-8800', supplierId: 'S-301' },
    ],
  },
  {
    id: 'DEV-003', name: 'OrthoFlex Revision Hip System', modelNumber: 'OF-RHS-200',
    serialRange: 'OF200-30001 to OF200-30120', fdaClass: 'III',
    status: 'production', unitsProduced: 120, recallStatus: 'none',
    lotComponents: [
      { partId: 'P-001', partName: 'Titanium Hip Stem', lotNumber: 'THS-2024-0742', supplierId: 'S-156' },
      { partId: 'P-002', partName: 'UHMWPE Liner', lotNumber: 'UPE-2024-0998', supplierId: 'S-203' },
      { partId: 'P-003', partName: 'Sterile Barrier Pouch', lotNumber: 'SBP-2024-4521', supplierId: 'S-087' },
    ],
  },
];

export const sampleDocUploads: DocumentUpload[] = [
  {
    id: 'DOC-001', fileName: 'TitanAlloy_ISO13485_Cert_2025.pdf', type: 'supplier_certificate',
    uploadedAt: '2024-12-20T10:30:00Z', status: 'linked',
    extractedData: { supplier: 'TitanAlloy Medical', certType: 'ISO 13485:2016', expiry: '2025-09-01', scope: 'Orthopedic implant components' },
    linkedRecords: ['S-156'],
  },
  {
    id: 'DOC-002', fileName: 'Incoming_Inspection_Lot_SCS-2024-3188.xlsx', type: 'inspection_sheet',
    uploadedAt: '2024-12-19T14:15:00Z', status: 'flagged',
    extractedData: { lotNumber: 'SCS-2024-3188', partNumber: 'SCS-2250', sampleSize: '50', defectsFound: '4', defectRate: '8.0%' },
    linkedRecords: ['P-004', 'S-112'],
    flags: ['Defect rate 8.0% exceeds threshold (2%)', 'NCR auto-generated: NCR-1042'],
  },
  {
    id: 'DOC-003', fileName: 'Batch_Record_UPE-2024-0998.pdf', type: 'batch_record',
    uploadedAt: '2024-12-18T09:00:00Z', status: 'flagged',
    extractedData: { lotNumber: 'UPE-2024-0998', material: 'GUR 1020 UHMWPE', crosslinkDose: '95 kGy', tensileStrength: '42.1 MPa' },
    linkedRecords: ['P-002', 'S-203'],
    flags: ['Tensile strength 42.1 MPa below spec minimum (43.0 MPa)', 'Lot quarantined'],
  },
];
