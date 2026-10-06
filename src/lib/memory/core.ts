import type { Library, MemoryEntry, Message, Role } from './types.js';

export function emptyLibrary(): Library {
  return { version: 1, conversations: [], memories: [] };
}

function invalid(path: string, reason: string): never {
  throw new Error(`备份无效：${path} ${reason}`);
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(path, '必须是对象');
  return value as Record<string, unknown>;
}

function string(value: unknown, path: string): string {
  if (typeof value !== 'string') invalid(path, '必须是字符串');
  return value;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) invalid(path, '必须是数组');
  return value;
}

function id(value: unknown, path: string, used?: Set<string>): string {
  const result = string(value, path);
  if (!result.trim()) invalid(path, 'ID 不能为空');
  if (used?.has(result)) invalid(path, 'ID 重复');
  used?.add(result);
  return result;
}

function choice<T extends string>(value: unknown, choices: readonly T[], path: string): T {
  if (typeof value !== 'string' || !choices.includes(value as T)) invalid(path, '类型不受支持');
  return value as T;
}

function date(value: unknown, path: string): string {
  const result = string(value, path);
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2})))?$/.exec(
      result,
    );
  if (!parts || !Number.isFinite(Date.parse(result))) invalid(path, '日期无效，请使用 ISO 日期');
  const year = Number(parts[1]);
  const month = Number(parts[2]);
  const day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > days[month - 1] ||
    Number(parts[4] ?? 0) > 23 ||
    Number(parts[5] ?? 0) > 59 ||
    Number(parts[6] ?? 0) > 59 ||
    Number(parts[7] ?? 0) > 23 ||
    Number(parts[8] ?? 0) > 59
  )
    invalid(path, '日期无效');
  return result;
}

export function validateLibrary(input: unknown): Library {
  const root = object(input, 'library');
  if (root.version !== 1) invalid('version', '版本必须为 1');
  const conversationIds = new Set<string>();
  const messageIds = new Set<string>();
  const memoryIds = new Set<string>();
  const conversations = array(root.conversations, 'conversations').map((value, index) => {
    const path = `conversations[${index}]`;
    const conversation = object(value, path);
    return {
      id: id(conversation.id, `${path}.id`, conversationIds),
      title: string(conversation.title, `${path}.title`),
      source: string(conversation.source, `${path}.source`),
      createdAt: date(conversation.createdAt, `${path}.createdAt`),
      updatedAt: date(conversation.updatedAt, `${path}.updatedAt`),
      messages: array(conversation.messages, `${path}.messages`).map((value, index): Message => {
        const messagePath = `${path}.messages[${index}]`;
        const message = object(value, messagePath);
        return {
          id: id(message.id, `${messagePath}.id`, messageIds),
          role: choice(message.role, ['user', 'assistant', 'system'], `${messagePath}.role`),
          content: string(message.content, `${messagePath}.content`),
        };
      }),
    };
  });
  const sourceMessages = new Map(
    conversations.map((conversation) => [
      conversation.id,
      new Set(conversation.messages.map((message) => message.id)),
    ]),
  );
  const memories = array(root.memories, 'memories').map((value, index): MemoryEntry => {
    const path = `memories[${index}]`;
    const memory = object(value, path);
    return {
      id: id(memory.id, `${path}.id`, memoryIds),
      title: string(memory.title, `${path}.title`),
      summary: string(memory.summary, `${path}.summary`),
      kind: choice(memory.kind, ['fact', 'preference', 'decision', 'learning'], `${path}.kind`),
      project: string(memory.project, `${path}.project`),
      tags: array(memory.tags, `${path}.tags`).map((tag, index) =>
        string(tag, `${path}.tags[${index}]`),
      ),
      status: choice(memory.status, ['active', 'expired'], `${path}.status`),
      createdAt: date(memory.createdAt, `${path}.createdAt`),
      updatedAt: date(memory.updatedAt, `${path}.updatedAt`),
      sourceRefs: array(memory.sourceRefs, `${path}.sourceRefs`).map((value, index) => {
        const refPath = `${path}.sourceRefs[${index}]`;
        const ref = object(value, refPath);
        const conversationId = id(ref.conversationId, `${refPath}.conversationId`);
        const knownMessages = sourceMessages.get(conversationId);
        if (!knownMessages) invalid(`${refPath}.conversationId`, '引用的对话不存在');
        const used = new Set<string>();
        const messageIds = array(ref.messageIds, `${refPath}.messageIds`).map((value, index) => {
          const messageId = id(value, `${refPath}.messageIds[${index}]`, used);
          if (!knownMessages.has(messageId))
            invalid(`${refPath}.messageIds[${index}]`, '引用的消息不属于该对话');
          return messageId;
        });
        return { conversationId, messageIds };
      }),
    };
  });
  return { version: 1, conversations, memories };
}

const roles: Record<string, Role> = {
  user: 'user',
  用户: 'user',
  assistant: 'assistant',
  助手: 'assistant',
  助理: 'assistant',
  system: 'system',
  系统: 'system',
};

export async function parseImport(
  text: string,
  filename: string,
  now = new Date().toISOString(),
): Promise<Library> {
  const normalized = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
  if (/\.json$/i.test(filename)) return validateLibrary(JSON.parse(normalized));
  if (!/\.(md|txt)$/i.test(filename)) throw new Error('仅支持 .json、.md 和 .txt 文件');
  if (!normalized) throw new Error('对话内容不能为空');
  date(now, 'import.createdAt');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const conversationId = `text-${hash}`;
  const messages: Message[] = [];
  let role: Role = 'user';
  let lines: string[] = [];
  let marked = false;
  let fence: { character: '`' | '~'; length: number } | undefined;
  const flush = () => {
    const content = lines.join('\n').trim();
    if (content || marked)
      messages.push({ id: `${conversationId}-message-${messages.length + 1}`, role, content });
    lines = [];
  };
  for (const line of normalized.split('\n')) {
    if (fence) {
      lines.push(line);
      const closing = new RegExp(`^\\s{0,3}${fence.character}{${fence.length},}\\s*$`).test(line);
      if (closing) fence = undefined;
      continue;
    }

    const opening = /^\s{0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (opening && (opening[1][0] !== '`' || !opening[2].includes('`'))) {
      lines.push(line);
      fence = { character: opening[1][0] as '`' | '~', length: opening[1].length };
      continue;
    }

    const heading = /^##\s+(user|assistant|system|用户|助手|助理|系统)\s*$/i.exec(line);
    if (heading) {
      flush();
      role = roles[heading[1].toLowerCase()];
      marked = true;
    } else lines.push(line);
  }
  flush();
  return validateLibrary({
    version: 1,
    memories: [],
    conversations: [
      {
        id: conversationId,
        title:
          filename
            .split(/[\\/]/)
            .pop()!
            .replace(/\.(md|txt)$/i, '') || '导入的对话',
        source: filename,
        createdAt: now,
        updatedAt: now,
        messages,
      },
    ],
  });
}

function mergeRecords<T extends { id: string; updatedAt: string }>(
  existing: T[],
  incoming: T[],
): T[] {
  const records = new Map(existing.map((record) => [record.id, record]));
  for (const record of incoming) {
    const previous = records.get(record.id);
    if (!previous || Date.parse(record.updatedAt) > Date.parse(previous.updatedAt))
      records.set(record.id, record);
  }
  return [...records.values()];
}

export function mergeLibraries(existing: Library, incoming: Library): Library {
  const current = validateLibrary(existing);
  const imported = validateLibrary(incoming);
  return validateLibrary({
    version: 1,
    conversations: mergeRecords(current.conversations, imported.conversations),
    memories: mergeRecords(current.memories, imported.memories),
  });
}

export function filterMemories(
  entries: MemoryEntry[],
  filters: {
    query?: string;
    kind?: string;
    status?: string;
    project?: string;
    tag?: string;
    updatedFrom?: string;
    updatedTo?: string;
  },
): MemoryEntry[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  // Date inputs supply YYYY-MM-DD. Both boundaries include the whole UTC day.
  return entries.filter((entry) => {
    const updatedDay = new Date(entry.updatedAt).toISOString().slice(0, 10);
    return (
      (!filters.kind || entry.kind === filters.kind) &&
      (!filters.status || entry.status === filters.status) &&
      (!filters.project || entry.project === filters.project) &&
      (!filters.tag || entry.tags.includes(filters.tag)) &&
      (!filters.updatedFrom || updatedDay >= filters.updatedFrom) &&
      (!filters.updatedTo || updatedDay <= filters.updatedTo) &&
      (!query ||
        [entry.title, entry.summary, entry.project, ...entry.tags]
          .join('\n')
          .toLowerCase()
          .includes(query))
    );
  });
}

export function buildContext(entries: MemoryEntry[], library: Library): string {
  const conversations = new Map(
    library.conversations.map((conversation) => [conversation.id, conversation]),
  );
  return entries
    .filter((entry) => entry.status === 'active')
    .map((entry) => {
      const sources = entry.sourceRefs.map((ref) => {
        const source = conversations.get(ref.conversationId);
        if (!source) throw new Error('记忆引用的对话不存在');
        return `来源：${source.title}（更新：${source.updatedAt}；消息：${ref.messageIds.join('、') || '整段对话'}）`;
      });
      return [`## ${entry.title}`, entry.summary, `更新：${entry.updatedAt}`, ...sources].join(
        '\n',
      );
    })
    .join('\n\n');
}

export function exportBackup(library: Library): string {
  return JSON.stringify(validateLibrary(library), null, 2);
}
