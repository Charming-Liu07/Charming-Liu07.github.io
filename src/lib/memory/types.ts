export type Role = 'user' | 'assistant' | 'system';
export type MemoryKind = 'fact' | 'preference' | 'decision' | 'learning';
export type MemoryStatus = 'active' | 'expired';
export interface Message {
  id: string;
  role: Role;
  content: string;
}
export interface Conversation {
  id: string;
  title: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}
export interface SourceRef {
  conversationId: string;
  messageIds: string[];
}
export interface MemoryEntry {
  id: string;
  title: string;
  summary: string;
  kind: MemoryKind;
  project: string;
  tags: string[];
  status: MemoryStatus;
  createdAt: string;
  updatedAt: string;
  sourceRefs: SourceRef[];
}
export interface Library {
  version: 1;
  conversations: Conversation[];
  memories: MemoryEntry[];
}
