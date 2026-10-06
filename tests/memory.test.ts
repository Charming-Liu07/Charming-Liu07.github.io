import assert from 'node:assert/strict';
import test from 'node:test';
import {
  emptyLibrary,
  validateLibrary,
  parseImport,
  mergeLibraries,
  filterMemories,
  buildContext,
  exportBackup,
} from '../src/lib/memory/core.js';
import type { Library, MemoryEntry } from '../src/lib/memory/types.js';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { readLibrary, updateLibrary } from '../src/lib/memory/storage.js';

const date = '2026-10-06T08:00:00.000Z';

test('role headings inside fenced snippets remain in the original message', async () => {
  const text = [
    '## user',
    '这是一段 Markdown 示例：',
    '```md',
    '## assistant',
    '示例内容',
    '```',
    '## assistant',
    '收到。',
  ].join('\n');
  const imported = await parseImport(text, 'fenced.md');
  assert.deepEqual(
    imported.conversations[0].messages.map((message) => message.role),
    ['user', 'assistant'],
  );
  assert.ok(imported.conversations[0].messages[0].content.includes('## assistant\n示例内容'));
});

test('tilde fences and longer closing fences keep role headings as content', async () => {
  const text = [
    '## user',
    '~~~md',
    '## assistant',
    '~~~',
    '~~~~',
    '## assistant',
    '这仍然在四字符围栏里',
    '~~~~~',
    '## assistant',
    '收到。',
  ].join('\n');
  const imported = await parseImport(text, 'fences.md');
  assert.deepEqual(
    imported.conversations[0].messages.map((message) => message.role),
    ['user', 'assistant'],
  );
  assert.ok(
    imported.conversations[0].messages[0].content.includes('## assistant\n这仍然在四字符围栏里'),
  );
});

test('an unclosed fence keeps later role headings in the original message', async () => {
  const imported = await parseImport(
    ['## user', '```md', '## assistant', '代码还没结束'].join('\n'),
    'unclosed.md',
  );
  assert.deepEqual(
    imported.conversations[0].messages.map((message) => message.role),
    ['user'],
  );
  assert.ok(imported.conversations[0].messages[0].content.includes('## assistant'));
});

function fixture(): Library {
  return {
    version: 1,
    conversations: [
      {
        id: 'conversation-1',
        title: '设计讨论',
        source: 'conversation.md',
        createdAt: date,
        updatedAt: date,
        messages: [
          { id: 'message-1', role: 'user', content: '<script>不执行</script>' },
          { id: 'message-2', role: 'assistant', content: '确认' },
        ],
      },
    ],
    memories: [
      {
        id: 'memory-1',
        title: '偏好',
        summary: '使用中文界面',
        kind: 'preference',
        project: '博客',
        tags: ['界面', '中文'],
        status: 'active',
        createdAt: date,
        updatedAt: date,
        sourceRefs: [{ conversationId: 'conversation-1', messageIds: ['message-1'] }],
      },
    ],
  };
}

test('fresh libraries contain no invented history and are independent', () => {
  const first = emptyLibrary();
  assert.deepEqual(first, { version: 1, conversations: [], memories: [] });
  first.conversations.push(fixture().conversations[0]);
  assert.equal(emptyLibrary().conversations.length, 0);
});

test('invalid backups fail all-or-nothing', async () => {
  const invalid = fixture();
  invalid.memories.push({
    ...invalid.memories[0],
    id: 'bad',
    kind: 'unknown' as MemoryEntry['kind'],
  });
  assert.throws(() => validateLibrary(invalid), /kind|类型/);
  await assert.rejects(parseImport(JSON.stringify(invalid), 'backup.json'), /kind|类型/);
  assert.throws(
    () => validateLibrary({ version: 2, conversations: [], memories: [] }),
    /version|版本/,
  );
  await assert.rejects(parseImport('{broken', 'backup.json'));
});

test('validation rejects malformed fields, invalid calendar dates and duplicate IDs', () => {
  for (const invalidDate of ['not-a-date', '2026-02-30T08:00:00Z']) {
    const invalid = fixture();
    invalid.conversations[0].createdAt = invalidDate;
    assert.throws(() => validateLibrary(invalid), /createdAt|日期/);
  }
  const duplicate = fixture();
  duplicate.conversations.push(structuredClone(duplicate.conversations[0]));
  assert.throws(() => validateLibrary(duplicate), /duplicate|重复/);
  const duplicateMessage = fixture();
  duplicateMessage.conversations[0].messages.push({
    ...duplicateMessage.conversations[0].messages[0],
  });
  assert.throws(() => validateLibrary(duplicateMessage), /duplicate|重复/);
  const duplicateMemory = fixture();
  duplicateMemory.memories.push(structuredClone(duplicateMemory.memories[0]));
  assert.throws(() => validateLibrary(duplicateMemory), /duplicate|重复/);
  const missing = fixture() as unknown as { memories: Record<string, unknown>[] };
  delete missing.memories[0].tags;
  assert.throws(() => validateLibrary(missing), /tags/);
});

test('conversation Markdown preserves role and message order including Chinese headings', async () => {
  const imported = await parseImport(
    '## system\n规则\n## user\n你好\n## assistant\n你好！\n## 用户\n问题\n## 助手\n回答\n## 系统\n结束',
    'session.md',
    date,
  );
  assert.deepEqual(
    imported.conversations[0].messages.map((message) => message.role),
    ['system', 'user', 'assistant', 'user', 'assistant', 'system'],
  );
  assert.deepEqual(
    imported.conversations[0].messages.map((message) => message.content),
    ['规则', '你好', '你好！', '问题', '回答', '结束'],
  );
  assert.equal(imported.conversations[0].title, 'session');
  assert.equal(imported.conversations[0].updatedAt, date);
  assert.deepEqual(imported.memories, []);
});

test('BOM and CRLF imports normalize to the same stable text IDs', async () => {
  const windows = await parseImport(
    '\uFEFF## user\r\n你好\r\n## assistant\r\n你好！\r\n',
    'windows.md',
    date,
  );
  const unix = await parseImport(
    '## user\n你好\n## assistant\n你好！',
    'unix.md',
    '2026-10-07T08:00:00Z',
  );
  assert.equal(windows.conversations[0].id, unix.conversations[0].id);
  assert.deepEqual(windows.conversations[0].messages, unix.conversations[0].messages);
  assert.equal(mergeLibraries(windows, unix).conversations.length, 1);
});

test('unmarked plain text imports as one user message without HTML interpretation', async () => {
  const imported = await parseImport('<img src=x onerror=alert(1)>\n笔记', 'notes.txt', date);
  assert.deepEqual(
    imported.conversations[0].messages.map(({ role, content }) => ({ role, content })),
    [{ role: 'user', content: '<img src=x onerror=alert(1)>\n笔记' }],
  );
  await assert.rejects(parseImport(' \r\n ', 'empty.txt', date), /empty|空/);
});

test('identical text and backup imports are idempotent', async () => {
  const imported = await parseImport('## user\n你好\n## assistant\n你好！', 'session.md', date);
  assert.deepEqual(mergeLibraries(imported, imported), imported);
  const original = fixture();
  const backup = await parseImport(exportBackup(original), 'backup.json');
  assert.deepEqual(mergeLibraries(original, backup), original);
});

test('corrupted conversation and message source references are rejected', () => {
  const missingConversation = fixture();
  missingConversation.memories[0].sourceRefs[0].conversationId = 'missing';
  assert.throws(() => validateLibrary(missingConversation), /reference|引用|conversationId/);
  const missingMessage = fixture();
  missingMessage.memories[0].sourceRefs[0].messageIds = ['missing'];
  assert.throws(() => validateLibrary(missingMessage), /reference|引用|messageIds/);
});

test('merge retains newer conversation and memory records without mutating either input', () => {
  const older = fixture();
  const newer = fixture();
  newer.conversations[0].title = '最新讨论';
  newer.conversations[0].updatedAt = '2026-10-07T08:00:00Z';
  newer.memories[0].summary = '新的偏好';
  newer.memories[0].updatedAt = '2026-10-07T08:00:00Z';
  const merged = mergeLibraries(newer, older);
  assert.equal(merged.conversations[0].title, '最新讨论');
  assert.equal(merged.memories[0].summary, '新的偏好');
  merged.memories[0].tags.push('new');
  assert.deepEqual(newer.memories[0].tags, ['界面', '中文']);
});

test('merge rejects a resulting broken source relationship', () => {
  const old = fixture();
  const incoming = fixture();
  incoming.conversations[0].messages = [];
  incoming.conversations[0].updatedAt = '2026-10-07T08:00:00Z';
  incoming.memories = [];
  assert.throws(() => mergeLibraries(old, incoming), /reference|引用|messageIds/);
});

test('memory filters combine query, kind, status and project', () => {
  const entries = fixture().memories;
  entries.push({
    ...entries[0],
    id: 'memory-2',
    title: '学习',
    summary: 'React tips',
    kind: 'learning',
    status: 'expired',
    project: '其他',
    tags: ['CODE'],
  });
  assert.deepEqual(
    filterMemories(entries, {
      query: '中文',
      kind: 'preference',
      status: 'active',
      project: '博客',
    }).map((entry) => entry.id),
    ['memory-1'],
  );
  assert.deepEqual(
    filterMemories(entries, { query: 'code' }).map((entry) => entry.id),
    ['memory-2'],
  );
  assert.deepEqual(
    filterMemories(entries, { query: '  react  ' }).map((entry) => entry.id),
    ['memory-2'],
  );
  assert.deepEqual(filterMemories(entries, { status: 'active', kind: 'learning' }), []);
});

test('exact tag filtering combines with the existing memory filters', () => {
  const entry = fixture().memories[0];
  const entries = [
    entry,
    { ...entry, id: 'prefix', tags: ['中文写作'] },
    { ...entry, id: 'other-project', project: '其他' },
    { ...entry, id: 'expired', status: 'expired' as const },
  ];
  assert.deepEqual(
    filterMemories(entries, {
      query: '界面',
      kind: 'preference',
      status: 'active',
      project: '博客',
      tag: '中文',
    }).map((memory) => memory.id),
    ['memory-1'],
  );
  assert.deepEqual(filterMemories(entries, { tag: '中' }), []);
  assert.deepEqual(filterMemories(entries, { tag: '' }), entries);
});

test('updated date filtering uses inclusive UTC days for ISO offsets and date-only values', () => {
  const entry = fixture().memories[0];
  const entries = [
    { ...entry, id: 'previous', updatedAt: '2026-10-06T00:30:00+02:00' },
    { ...entry, id: 'offset', updatedAt: '2026-10-05T23:30:00-02:00' },
    { ...entry, id: 'day-only', updatedAt: '2026-10-06' },
    { ...entry, id: 'late', updatedAt: '2026-10-06T23:59:59.999Z' },
    { ...entry, id: 'next', updatedAt: '2026-10-07T00:00:00Z' },
  ];
  assert.deepEqual(
    filterMemories(entries, { updatedFrom: '2026-10-06', updatedTo: '2026-10-06' }).map(
      (memory) => memory.id,
    ),
    ['offset', 'day-only', 'late'],
  );
  assert.deepEqual(
    filterMemories(entries, { updatedTo: '2026-10-05' }).map((memory) => memory.id),
    ['previous'],
  );
  assert.deepEqual(
    filterMemories(entries, { updatedFrom: '2026-10-07' }).map((memory) => memory.id),
    ['next'],
  );
  assert.deepEqual(filterMemories(entries, { updatedFrom: '', updatedTo: '' }), entries);
  assert.deepEqual(
    filterMemories(entries, { updatedFrom: '2026-10-07', updatedTo: '2026-10-06' }),
    [],
  );
  assert.equal(entries.length, 5);
});

test('context excludes expired entries and includes source titles and updated dates', () => {
  const library = fixture();
  const expired = {
    ...library.memories[0],
    id: 'expired',
    title: '过期秘密',
    summary: '不应进入上下文',
    status: 'expired' as const,
  };
  const context = buildContext([...library.memories, expired], library);
  assert.match(context, /使用中文界面/);
  assert.match(context, /设计讨论/);
  assert.match(context, /2026-10-06/);
  assert.doesNotMatch(context, /过期秘密|不应进入上下文/);
  assert.equal(buildContext([expired], library), '');
});

test('backup round trip retains every field and validation returns a detached copy', async () => {
  const library = fixture();
  assert.deepEqual(await parseImport('\uFEFF' + exportBackup(library), 'backup.json'), library);
  const validated = validateLibrary(library);
  validated.memories[0].tags.push('changed');
  assert.deepEqual(library.memories[0].tags, ['界面', '中文']);
});

test('IndexedDB persists validated updates and serializes concurrent writers', async () => {
  globalThis.indexedDB = new IDBFactory();
  assert.deepEqual(await readLibrary(), emptyLibrary());
  await Promise.all(
    Array.from({ length: 12 }, (_, index) =>
      updateLibrary((current) => ({
        ...current,
        conversations: [
          ...current.conversations,
          {
            ...fixture().conversations[0],
            id: `c-${index}`,
            messages: [{ id: `m-${index}`, role: 'user', content: String(index) }],
          },
        ],
      })),
    ),
  );
  const persisted = await readLibrary();
  assert.equal(persisted.conversations.length, 12);
  assert.equal(new Set(persisted.conversations.map((conversation) => conversation.id)).size, 12);
});

test('IndexedDB invalid updates and updater errors roll back prior state', async () => {
  globalThis.indexedDB = new IDBFactory();
  await updateLibrary(() => fixture());
  await assert.rejects(
    updateLibrary((current) => {
      current.memories[0].sourceRefs[0].messageIds = ['missing'];
      return current;
    }),
    /messageIds|引用/,
  );
  assert.deepEqual(await readLibrary(), fixture());
  await assert.rejects(
    updateLibrary(() => {
      throw new Error('update failed');
    }),
    /update failed/,
  );
  assert.deepEqual(await readLibrary(), fixture());
});

test('IndexedDB unavailable and write failures reject without claiming success', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Reflect.deleteProperty(globalThis, 'indexedDB');
  await assert.rejects(readLibrary(), /IndexedDB|存储/);
  await assert.rejects(
    updateLibrary(() => fixture()),
    /IndexedDB|存储/,
  );
  Object.defineProperty(globalThis, 'indexedDB', descriptor!);
  globalThis.indexedDB = new IDBFactory();
  await updateLibrary(() => fixture());
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function () {
    throw new DOMException('Quota exceeded', 'QuotaExceededError');
  };
  try {
    await assert.rejects(
      updateLibrary(() => emptyLibrary()),
      /Quota exceeded/,
    );
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.deepEqual(await readLibrary(), fixture());
});

test('IndexedDB corrupted persisted records reject both reads and updates', async () => {
  globalThis.indexedDB = new IDBFactory();
  await readLibrary();
  await new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('charming-local-memory', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const transaction = open.result.transaction('library', 'readwrite');
      transaction.objectStore('library').put({ ...fixture(), version: 9 }, 'current');
      transaction.oncomplete = () => {
        open.result.close();
        resolve();
      };
      transaction.onabort = () => {
        open.result.close();
        reject(transaction.error);
      };
    };
  });
  await assert.rejects(readLibrary(), /version|版本/);
  let called = false;
  await assert.rejects(
    updateLibrary(() => {
      called = true;
      return emptyLibrary();
    }),
    /version|版本/,
  );
  assert.equal(called, false);
});
