function serializeValue(value) {
  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item));
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value && typeof value === "object") {
    if (typeof value.toHexString === "function") {
      return value.toHexString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, serializeValue(entryValue)]),
    );
  }

  return value;
}

export async function writeVersionSnapshot(db, {
  ownerUserId,
  actor,
  entityType,
  entityId,
  eventType,
  before = null,
  after = null,
  metadata = {},
}) {
  await db.collection("version_snapshots").insertOne({
    owner_user_id: ownerUserId,
    actor_user_id: actor.id,
    actor_email: actor.email || null,
    actor_name: actor.name || null,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    before: before ? serializeValue(before) : null,
    after: after ? serializeValue(after) : null,
    metadata: serializeValue(metadata),
    created_at: new Date().toISOString(),
  });
}
