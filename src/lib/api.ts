const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type EntityName =
  | "suppliers"
  | "parts"
  | "lots"
  | "devices"
  | "inspections"
  | "ncrs"
  | "capas";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export function getDocumentFileUrl(documentId: string, userId: string) {
  const params = new URLSearchParams({ userId });
  return `${API_BASE_URL}/api/documents/${documentId}/file?${params.toString()}`;
}

export async function listDocuments(userId: string) {
  const params = new URLSearchParams({ userId });
  return apiFetch<any[]>(`/api/documents?${params.toString()}`);
}

export async function uploadDocuments(userId: string, files: FileList | File[]) {
  const formData = new FormData();
  formData.append("userId", userId);
  for (const file of Array.from(files)) {
    formData.append("files", file);
  }

  return apiFetch<any[]>("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function processUploadedDocument(documentId: string, userId: string) {
  return apiFetch<any>(`/api/documents/${documentId}/process`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId }),
  });
}

export async function deleteDocument(documentId: string, userId: string) {
  const params = new URLSearchParams({ userId });
  return apiFetch<void>(`/api/documents/${documentId}?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function listQmsRecords(entity: EntityName, userId: string) {
  const params = new URLSearchParams({ userId });
  return apiFetch<any[]>(`/api/qms/${entity}?${params.toString()}`);
}

export async function createQmsRecord(entity: EntityName, userId: string, payload: Record<string, any>) {
  return apiFetch<any>(`/api/qms/${entity}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, userId }),
  });
}

export async function updateQmsRecord(entity: EntityName, id: string, payload: Record<string, any>) {
  return apiFetch<any>(`/api/qms/${entity}/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteQmsRecord(entity: EntityName, id: string, userId: string) {
  const params = new URLSearchParams({ userId });
  return apiFetch<void>(`/api/qms/${entity}/${id}?${params.toString()}`, {
    method: "DELETE",
  });
}

export async function listAgentRuns(userId: string, agentType?: string) {
  const params = new URLSearchParams({ userId });
  if (agentType) params.set("agent_type", agentType);
  return apiFetch<any[]>(`/api/agent-runs?${params.toString()}`);
}

export async function resolveAgentRun(id: string, userId: string) {
  return apiFetch<any>(`/api/agent-runs/${id}/resolve`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

export async function triggerInspectionAgent(inspectionId: string, userId: string) {
  return apiFetch<any>(`/api/agents/inspection/${inspectionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
}

/** Dedicated CAPA agent (NCR history → patterns → CAPA → notifications). Separate from inspection agent. */
export async function runCapaAgent(
  userId: string,
  options?: { days_back?: number; min_cluster_size?: number },
) {
  return apiFetch<any>("/api/agents/capa/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, options: options || {} }),
  });
}

/** Supplier agent: cert expiry, NCR trends, risk scoring, optional profile updates and procurement notices. */
export async function runSupplierAgent(
  userId: string,
  options?: { days_back?: number; supplier_id?: string },
) {
  return apiFetch<any>("/api/agents/supplier/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, options: options || {} }),
  });
}

/** Compliance agent: cross-domain regulatory risk prioritization; writes to compliance_agent_* collections only. */
export async function runComplianceAgent(userId: string, options?: { horizon_days?: number }) {
  return apiFetch<any>("/api/agents/compliance/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, options: options || {} }),
  });
}

export async function listComplianceAgentItems(userId: string, limit?: number) {
  const params = new URLSearchParams({ userId });
  if (limit != null) params.set("limit", String(limit));
  return apiFetch<any[]>(`/api/agents/compliance/items?${params.toString()}`);
}
