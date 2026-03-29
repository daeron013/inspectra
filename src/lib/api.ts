const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
let apiAccessTokenProvider: (() => Promise<string | null>) | null = null;

type EntityName =
  | "suppliers"
  | "parts"
  | "lots"
  | "devices"
  | "inspections"
  | "ncrs"
  | "capas";

export function setApiAccessTokenProvider(provider: (() => Promise<string | null>) | null) {
  apiAccessTokenProvider = provider;
}

async function getAuthHeaders() {
  const token = apiAccessTokenProvider ? await apiAccessTokenProvider() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...authHeaders,
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

export async function getDocumentFileUrl(documentId: string, _userId?: string) {
  const authHeaders = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/file`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed: ${response.status}`);
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function listDocuments(_userId?: string) {
  return apiFetch<any[]>("/api/documents");
}

export async function uploadDocuments(_userId: string, files: FileList | File[]) {
  const formData = new FormData();
  for (const file of Array.from(files)) {
    formData.append("files", file);
  }

  return apiFetch<any[]>("/api/documents/upload", {
    method: "POST",
    body: formData,
  });
}

export async function processUploadedDocument(documentId: string, _userId?: string) {
  return apiFetch<any>(`/api/documents/${documentId}/process`, {
    method: "POST",
  });
}

export async function deleteDocument(documentId: string, _userId?: string) {
  return apiFetch<void>(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function listQmsRecords(entity: EntityName, _userId?: string) {
  return apiFetch<any[]>(`/api/qms/${entity}`);
}

export async function createQmsRecord(entity: EntityName, _userId: string, payload: Record<string, any>) {
  return apiFetch<any>(`/api/qms/${entity}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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

export async function deleteQmsRecord(entity: EntityName, id: string, _userId?: string) {
  return apiFetch<void>(`/api/qms/${entity}/${id}`, {
    method: "DELETE",
  });
}

export async function listAgentRuns(_userId?: string, agentType?: string) {
  const params = new URLSearchParams();
  if (agentType) params.set("agent_type", agentType);
  return apiFetch<any[]>(`/api/agent-runs?${params.toString()}`);
}

export async function resolveAgentRun(id: string, _userId?: string) {
  return apiFetch<any>(`/api/agent-runs/${id}/resolve`, {
    method: "PATCH",
  });
}

export async function triggerInspectionAgent(inspectionId: string, _userId?: string) {
  return apiFetch<any>(`/api/agents/inspection/${inspectionId}`, {
    method: "POST",
  });
}

/** Dedicated CAPA agent (NCR history → patterns → CAPA → notifications). Separate from inspection agent. */
export async function runCapaAgent(
  _userId: string,
  options?: { days_back?: number; min_cluster_size?: number },
) {
  return apiFetch<any>("/api/agents/capa/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: options || {} }),
  });
}

/** Supplier agent: cert expiry, NCR trends, risk scoring, optional profile updates and procurement notices. */
export async function runSupplierAgent(
  _userId: string,
  options?: { days_back?: number; supplier_id?: string },
) {
  return apiFetch<any>("/api/agents/supplier/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: options || {} }),
  });
}

/** Compliance agent: cross-domain regulatory risk prioritization; writes to compliance_agent_* collections only. */
export async function runComplianceAgent(_userId: string, options?: { horizon_days?: number }) {
  return apiFetch<any>("/api/agents/compliance/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ options: options || {} }),
  });
}

export async function listComplianceAgentItems(_userId?: string, limit?: number) {
  const params = new URLSearchParams();
  if (limit != null) params.set("limit", String(limit));
  return apiFetch<any[]>(`/api/agents/compliance/items?${params.toString()}`);
}
