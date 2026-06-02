import Dexie, { Table } from 'dexie';
import { ConversationMemory, DocumentChunk, DocumentStore, Message, Session, Prompt, ModelId, ResearchPlan } from '../types';

const safeUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

class AittcoChatDB extends Dexie {
  sessions!: Table<Session>;
  messages!: Table<Message>;
  prompts!: Table<Prompt>;
  researchPlans!: Table<ResearchPlan>;
  conversationMemories!: Table<ConversationMemory>;
  documentStores!: Table<DocumentStore>;
  documentChunks!: Table<DocumentChunk>;

  constructor() {
    super('AittcoChatDB');

    // v1: initial tables
    this.version(1).stores({
      sessions: 'id, updatedAt, model',
      messages: 'id, sessionId, timestamp',
    });

    // v2: add prompts table (legacy path)
    this.version(2).stores({
      prompts: 'id, title, createdAt',
    });

    // v3: fix full schema declaration for all users
    this.version(3).stores({
      sessions: 'id, updatedAt, model',
      messages: 'id, sessionId, timestamp',
      prompts: 'id, title, createdAt',
    });

    // v4: store large parsed documents and persistent research plans outside messages
    this.version(4).stores({
      sessions: 'id, updatedAt, model',
      messages: 'id, sessionId, timestamp',
      prompts: 'id, title, createdAt',
      researchPlans: 'id, sessionId, updatedAt',
      documentStores: 'id, createdAt',
      documentChunks: 'id, documentId, index',
    });

    // v5: rolling conversation memory for long-running topics
    this.version(5).stores({
      sessions: 'id, updatedAt, model',
      messages: 'id, sessionId, timestamp',
      prompts: 'id, title, createdAt',
      researchPlans: 'id, sessionId, updatedAt',
      conversationMemories: 'id, sessionId, updatedAt',
      documentStores: 'id, createdAt',
      documentChunks: 'id, documentId, index',
    });
  }
}

export const db = new AittcoChatDB();

export const saveMessage = async (msg: Message) => {
  await db.transaction('rw', db.messages, db.sessions, async () => {
    await db.messages.put(msg);
    await db.sessions.update(msg.sessionId, {
      updatedAt: Date.now(),
      preview: msg.content.substring(0, 50) + (msg.content.length > 50 ? '...' : ''),
    });
  });
};

export const createSession = async (title: string, model: ModelId) => {
  const id = safeUuid();
  const session: Session = {
    id,
    title,
    updatedAt: Date.now(),
    model,
    preview: 'New conversation',
  };
  await db.sessions.add(session);
  return id;
};

export const saveResearchPlanRecord = async (plan: ResearchPlan) => {
  await db.researchPlans.put(plan);
};

export const getResearchPlanBySession = async (sessionId: string) => {
  return db.researchPlans.where('sessionId').equals(sessionId).first();
};

export const deleteResearchPlanBySession = async (sessionId: string) => {
  const plans = await db.researchPlans.where('sessionId').equals(sessionId).toArray();
  await db.researchPlans.bulkDelete(plans.map((plan) => plan.id));
};

export const saveConversationMemory = async (memory: ConversationMemory) => {
  await db.conversationMemories.put(memory);
};

export const getConversationMemoryBySession = async (sessionId: string) => {
  return db.conversationMemories.where('sessionId').equals(sessionId).first();
};

export const deleteConversationMemoryBySession = async (sessionId: string) => {
  const memories = await db.conversationMemories.where('sessionId').equals(sessionId).toArray();
  await db.conversationMemories.bulkDelete(memories.map((memory) => memory.id));
};

export const saveDocumentRecord = async (doc: DocumentStore, chunks: DocumentChunk[]) => {
  await db.transaction('rw', db.documentStores, db.documentChunks, async () => {
    await db.documentStores.put(doc);
    await db.documentChunks.where('documentId').equals(doc.id).delete();
    if (chunks.length > 0) {
      await db.documentChunks.bulkPut(chunks);
    }
  });
};

export const getDocumentChunks = async (documentId: string) => {
  return db.documentChunks.where('documentId').equals(documentId).sortBy('index');
};
