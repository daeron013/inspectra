import { getDb } from "./db.js";

const COLLECTION = "chat_history";

export async function getChatHistory(db, userId) {
  const doc = await db.collection(COLLECTION).findOne({ user_id: userId });
  return doc?.messages ?? [];
}

export async function saveChatHistory(db, userId, messages) {
  await db.collection(COLLECTION).updateOne(
    { user_id: userId },
    { $set: { messages, updated_at: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function clearChatHistory(db, userId) {
  await db.collection(COLLECTION).deleteOne({ user_id: userId });
}

export async function ensureChatHistoryIndexes(db) {
  await db.collection(COLLECTION).createIndex({ user_id: 1 }, { unique: true });
}
