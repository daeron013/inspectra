const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

type EntityName =
  | "suppliers"
  | "parts"
  | "lots"
  | "devices"
  | "inspections"
  | "ncrs"
  | "capas";

export type AuditLogRecord = {
  id: string;
  actor_user_id: string;
  actor_email?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  status: string;
  metadata?: Record<string, any> | null;
  request?: {
    method?: string | null;
    path?: string | null;
    ip?: string | null;
    user_agent?: string | null;
  } | null;
  created_at: string;
};

export type VersionSnapshotRecord = {
  id: string;
  owner_user_id: string;
  actor_user_id: string;
  actor_email?: string | null;
  actor_name?: string | null;
  entity_type: string;
  entity_id: string;
  event_type: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  created_at: string;
};

type AccessTokenProvider = (() => Promise<string | null>) | null;

let accessTokenProvider: AccessTokenProvider = null;

export function setApiAccessTokenProvider(provider: AccessTokenProvider) {
  accessTokenProvider = provider;
}

async function getAuthHeaders(extraHeaders?: HeadersInit) {
  const headers = new Headers(extraHeaders || {});
  const token = accessTokenProvider ? await accessTokenProvider() : null;
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await getAuthHeaders(init?.headers),
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

export async function getDocumentFileUrl(documentId: string) {
  const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}/file`, {
    headers: await getAuthHeaders(),
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
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
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

<<<<<<< HEAD
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
=======
export async function listAuditLogs(entityType: string, entityId?: string) {
  const params = new URLSearchParams({ entityType });
  if (entityId) {
    params.set("entityId", entityId);
  }
  return apiFetch<AuditLogRecord[]>(`/api/audit-logs?${params.toString()}`);
}

export async function listVersionSnapshots(entityType: string, entityId?: string) {
  const params = new URLSearchParams({ entityType });
  if (entityId) {
    params.set("entityId", entityId);
  }
  return apiFetch<VersionSnapshotRecord[]>(`/api/version-snapshots?${params.toString()}`);
>>>>>>> d31e8744 (fixed auth0)
}
