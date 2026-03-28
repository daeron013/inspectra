import { GridFSBucket, MongoClient, ObjectId } from "mongodb";

const dbName = process.env.MONGODB_DB_NAME || "inspectra";

let clientPromise;

export function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value === "string" && ObjectId.isValid(value)) return new ObjectId(value);
  if (value && typeof value === "object") {
    if (typeof value.$oid === "string" && ObjectId.isValid(value.$oid)) {
      return new ObjectId(value.$oid);
    }
    if ("id" in value) {
      try {
        return toObjectId(value.id);
      } catch {}
    }
    if ("_id" in value) {
      try {
        return toObjectId(value._id);
      } catch {}
    }
    if (typeof value.toHexString === "function") {
      const hex = value.toHexString();
      if (ObjectId.isValid(hex)) return new ObjectId(hex);
    }
    if (typeof value.toString === "function") {
      const stringValue = value.toString();
      if (ObjectId.isValid(stringValue)) return new ObjectId(stringValue);
    }
  }
  throw new Error(`Invalid ObjectId value: ${String(value)}`);
}

async function getClient() {
  if (!clientPromise) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error("MONGODB_URI is not configured");
    }
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }

  return clientPromise;
}

export async function getDb() {
  const client = await getClient();
  return client.db(dbName);
}

export async function getBucket() {
  const db = await getDb();
  return new GridFSBucket(db, { bucketName: "documents" });
}

export { ObjectId };
