export interface MetricData {
  label: string;
  value: number;
  change: number;
  status: 'success' | 'warning' | 'danger' | 'info';
  icon: string;
}

export interface PriorityItem {
  id: string;
  title: string;
  description: string;
  risk: 'critical' | 'high' | 'medium' | 'low';
  agent: string;
  timestamp: string;
  type: string;
}

export interface AgentRun {
  id: string;
  agent: 'supplier' | 'inspection' | 'capa' | 'compliance';
  agentLabel: string;
  action: string;
  detail: string;
  timestamp: string;
  result?: string;
}

export interface Supplier {
  id: string;
  name: string;
  status: 'approved' | 'conditional' | 'at-risk' | 'disqualified';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  lastAudit: string;
  nextRequalification: string;
  defectRate: number;
  partsSupplied: number;
  openNCRs: number;
}

export const metrics: MetricData[] = [
  { label: 'Parts Awaiting Inspection', value: 23, change: -12, status: 'warning', icon: 'search' },
  { label: 'Open Nonconformances', value: 7, change: 3, status: 'danger', icon: 'alert-triangle' },
  { label: 'Suppliers at Risk', value: 3, change: 1, status: 'danger', icon: 'shield-alert' },
  { label: 'Upcoming Requalifications', value: 5, change: 0, status: 'info', icon: 'clock' },
];

export const priorityItems: PriorityItem[] = [
  {
    id: '1',
    title: 'Requalify MedTech Components Ltd',
    description:
      'Regulatory risk triage: sole-source titanium supplier, Class II device exposure — requal overdue 14 days. Elevated above other upcoming deadlines.',
    risk: 'critical',
    agent: 'Compliance Agent',
    timestamp: '2 min ago',
    type: 'requalification',
  },
  {
    id: '2',
    title: 'High Defect Rate — Part #TI-4821',
    description: 'Defect rate at 6.2% (threshold: 2%). 3 lots affected across Q1.',
    risk: 'critical',
    agent: 'Inspection Agent',
    timestamp: '8 min ago',
    type: 'defect',
  },
  {
    id: '3',
    title: 'CAPA Required — Recurring Sterilization Failure',
    description: 'Pattern detected: 4 NCRs linked to sterilization packaging from Supplier S-203.',
    risk: 'high',
    agent: 'CAPA Agent',
    timestamp: '15 min ago',
    type: 'capa',
  },
  {
    id: '4',
    title: 'NCR #1042 — Dimensional Out of Spec',
    description: 'Lot 4821: 3/50 units failed dimensional check. Inspection agent opened NCR; disposition pending.',
    risk: 'high',
    agent: 'Inspection Agent',
    timestamp: '22 min ago',
    type: 'ncr',
  },
  {
    id: '5',
    title: 'Missing Inspection Record — Lot #7733',
    description: 'Incoming inspection not logged for shipment received 3 days ago.',
    risk: 'medium',
    agent: 'Compliance Agent',
    timestamp: '1 hr ago',
    type: 'documentation',
  },
];

export const agentRuns: AgentRun[] = [
  {
    id: '1',
    agent: 'inspection',
    agentLabel: 'Inspection Agent',
    action: 'Anomaly detected — dimensional failure',
    detail:
      'Lot 4821 — 3/50 units exceeded ±0.05mm tolerance. Opened NCR #1042; auto-linked to similar issues (NCR #998, #1011). Suggested disposition: Scrap.',
    timestamp: '2 min ago',
    result: 'NCR #1042 created',
  },
  {
    id: '2',
    agent: 'capa',
    agentLabel: 'CAPA Agent',
    action: 'NCR history scan — recurring pattern',
    detail:
      'Reviewed NCR stream: repeated failures across 3 lots from Supplier S-112. Opened CAPA; root cause hypothesis: supplier calibration drift.',
    timestamp: '5 min ago',
    result: 'CAPA opened',
  },
  {
    id: '3',
    agent: 'supplier',
    agentLabel: 'Supplier Agent',
    action: 'Supplier risk scoring refresh',
    detail:
      'MedTech Components Ltd — composite risk up: defect rate 1.2% → 3.8% → 6.2% over 3 quarters; ISO 13485 cert expires in 45 days.',
    timestamp: '12 min ago',
    result: 'Status → At Risk',
  },
  {
    id: '4',
    agent: 'compliance',
    agentLabel: 'Compliance Agent',
    action: 'Regulatory risk triage',
    detail:
      'Cross-checked deadlines vs. context: sole-source MedTech (Class II device) requal overdue 14 days → critical; other due dates lower priority (dual-sourced, clean audit history).',
    timestamp: '15 min ago',
    result: 'Critical queue updated',
  },
  {
    id: '5',
    agent: 'inspection',
    agentLabel: 'Inspection Agent',
    action: 'Visual inspection — minor anomaly',
    detail: 'Lot 7291 — surface finish variance on 1/30 samples; within spec. No NCR required.',
    timestamp: '28 min ago',
    result: 'Passed',
  },
];

export const suppliers: Supplier[] = [
  { id: 'S-112', name: 'MedTech Components Ltd', status: 'at-risk', riskLevel: 'critical', lastAudit: '2024-09-15', nextRequalification: '2024-12-15', defectRate: 6.2, partsSupplied: 12400, openNCRs: 3 },
  { id: 'S-203', name: 'PrecisionMed Plastics', status: 'conditional', riskLevel: 'high', lastAudit: '2024-11-01', nextRequalification: '2025-02-01', defectRate: 3.1, partsSupplied: 8200, openNCRs: 2 },
  { id: 'S-087', name: 'BioSafe Packaging Corp', status: 'approved', riskLevel: 'low', lastAudit: '2024-10-20', nextRequalification: '2025-01-20', defectRate: 0.4, partsSupplied: 45000, openNCRs: 0 },
  { id: 'S-156', name: 'TitanAlloy Medical', status: 'approved', riskLevel: 'low', lastAudit: '2024-11-10', nextRequalification: '2025-02-10', defectRate: 0.8, partsSupplied: 5600, openNCRs: 0 },
  { id: 'S-301', name: 'SterileTech Solutions', status: 'conditional', riskLevel: 'medium', lastAudit: '2024-08-05', nextRequalification: '2024-11-05', defectRate: 2.1, partsSupplied: 15300, openNCRs: 1 },
  { id: 'S-445', name: 'NanoCoat Medical', status: 'approved', riskLevel: 'low', lastAudit: '2024-12-01', nextRequalification: '2025-03-01', defectRate: 0.2, partsSupplied: 3100, openNCRs: 0 },
];

export const scenarioDefaults = {
  defectRate: 2.0,
  supplierDelay: 0,
  inspectionBacklog: 0,
};
