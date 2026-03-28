function toAuditValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => toAuditValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, toAuditValue(entryValue)]),
    );
  }

  return value;
}

export async function writeAuditLog(db, {
  actor,
  action,
  entityType,
  entityId = null,
  status = "success",
  metadata = {},
  req = null,
}) {
  const now = new Date().toISOString();

  await db.collection("audit_logs").insertOne({
    actor_user_id: actor.id,
    actor_email: actor.email || null,
    actor_name: actor.name || null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    status,
    metadata: toAuditValue(metadata),
    request: req ? {
      method: req.method,
      path: req.originalUrl || req.url,
      ip: req.ip,
      user_agent: req.header("user-agent") || null,
    } : null,
    created_at: now,
  });
}
