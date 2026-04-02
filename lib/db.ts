import Dexie, { Table } from 'dexie';
import { Message, Session, Prompt, ModelId } from '../types';

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
