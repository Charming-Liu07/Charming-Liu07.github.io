import { useEffect, useMemo, useRef, useState } from 'react';
import {
  buildContext,
  emptyLibrary,
  exportBackup,
  filterMemories,
  mergeLibraries,
  parseImport,
} from '../../lib/memory/core';
import { readLibrary, updateLibrary } from '../../lib/memory/storage';
import type { Conversation, Library, MemoryEntry } from '../../lib/memory/types';
import './memory.css';

import MemoryEditor, { kindNames } from './MemoryEditor';
import { Dialog, Glyph } from './MemoryUI';
const roleNames = { user: '用户', assistant: '助手', system: '系统' };
type Tab = 'memories' | 'conversations' | 'backup';
type Modal =
  | { type: 'edit'; entry?: MemoryEntry; conversation?: Conversation }
  | { type: 'paste' }
  | { type: 'import'; library: Library; filename: string }
  | { type: 'view'; conversation: Conversation }
  | { type: 'delete'; item: MemoryEntry | Conversation; category: 'memory' | 'conversation' };
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(date));
const errorLabel = (error: unknown) =>
  error instanceof Error ? error.message : '操作未完成，请重试。';

export default function MemoryWorkspace() {
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [hydrated, setHydrated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('memories');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('active');
  const [project, setProject] = useState('');
  const [tag, setTag] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [modal, setModal] = useState<Modal | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const mounted = useRef(false);
  const writing = useRef(false);
  const readSerial = useRef(0);
  async function refresh() {
    if (writing.current) return;
    const serial = ++readSerial.current;
    try {
      const next = await readLibrary();
      if (mounted.current && serial === readSerial.current && !writing.current) {
        setLibrary(next);
        setHydrated(true);
        setError('');
      }
    } catch (issue) {
      if (mounted.current && serial === readSerial.current) {
        setError(`无法读取本地存储：${errorLabel(issue)} 请检查浏览器是否允许此网站使用存储。`);
        setHydrated(false);
      }
    }
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  async function mutate(updater: (current: Library) => Library, message: string) {
    if (!hydrated || writing.current) return false;
    writing.current = true;
    readSerial.current++;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const next = await updateLibrary(updater);
      setLibrary(next);
      setNotice(message);
      return true;
    } catch (issue) {
      setError(`没有保存成功：${errorLabel(issue)} 你的输入仍保留在这里，请重试。`);
      return false;
    } finally {
      writing.current = false;
      setBusy(false);
    }
  }
  function rememberActivator(element?: HTMLElement) {
    const active = element ?? document.activeElement;
    if (
      active instanceof HTMLElement &&
      !active.closest('.mw-dialog') &&
      active.matches('button, a[href], input, select, textarea, [tabindex="0"]')
    ) {
      returnFocusRef.current = active;
    }
  }
  function open(next: Modal) {
    rememberActivator();
    setError('');
    setNotice('');
    setModal(next);
  }
  function activateTab(next: Tab) {
    setTab(next);
    setQuery('');
  }
  const disabled = !hydrated || busy;
  const activeCount = library.memories.filter((entry) => entry.status === 'active').length;
  const dateRangeError =
    updatedFrom && updatedTo && updatedFrom > updatedTo
      ? '更新自不能晚于更新至，请调整日期范围。'
      : '';
  const filtered = useMemo(
    () =>
      filterMemories(library.memories, {
        query,
        kind,
        status,
        project,
        tag,
        updatedFrom,
        updatedTo,
      }).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [library, query, kind, status, project, tag, updatedFrom, updatedTo],
  );
  const selectedEntries = library.memories.filter(
    (entry) => selected.includes(entry.id) && entry.status === 'active',
  );
  const context = buildContext(selectedEntries, library);
  const projects = [
    ...new Set(library.memories.map((entry) => entry.project).filter(Boolean)),
  ].sort();
  const tags = [...new Set(library.memories.flatMap((entry) => entry.tags).filter(Boolean))].sort();
  const conversations = library.conversations
    .filter((item) =>
      `${item.title} ${item.source} ${item.messages.map((message) => message.content).join(' ')}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  function download(text: string, filename: string, type: string) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function importText(text: string, filename: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const incoming = await parseImport(text, filename);
      setModal({ type: 'import', library: incoming, filename });
    } catch (issue) {
      setError(`导入未完成：${errorLabel(issue)}`);
    } finally {
      setBusy(false);
    }
  }
  async function saveEntry(entry: MemoryEntry) {
    const saved = await mutate(
      (current) => ({
        ...current,
        memories: [
          ...current.memories.filter((item) => item.id !== entry.id),
          {
            ...entry,
            createdAt:
              current.memories.find((item) => item.id === entry.id)?.createdAt ?? entry.createdAt,
            sourceRefs: entry.sourceRefs.filter((ref) =>
              current.conversations.some((item) => item.id === ref.conversationId),
            ),
          },
        ],
      }),
      '记忆已保存到当前浏览器。',
    );
    if (saved) {
      setModal(null);
      setTab('memories');
    }
  }
  async function confirmDelete(target: Extract<Modal, { type: 'delete' }>) {
    const saved = await mutate(
      (current) =>
        target.category === 'memory'
          ? { ...current, memories: current.memories.filter((item) => item.id !== target.item.id) }
          : {
              ...current,
              conversations: current.conversations.filter((item) => item.id !== target.item.id),
              memories: current.memories.map((entry) =>
                entry.sourceRefs.some((ref) => ref.conversationId === target.item.id)
                  ? {
                      ...entry,
                      sourceRefs: entry.sourceRefs.filter(
                        (ref) => ref.conversationId !== target.item.id,
                      ),
                      updatedAt: new Date().toISOString(),
                    }
                  : entry,
              ),
            },
      target.category === 'memory'
        ? '记忆已删除。'
        : '对话已删除。关联的记忆已保留，来源关联已解除。',
    );
    if (saved) {
      setModal(null);
      setSelected((ids) => ids.filter((id) => id !== target.item.id));
    }
  }
  return (
    <div className="memory-workspace" data-pagefind-ignore>
      <header className="mw-header">
        <div>
          <div className="mw-eyebrow">
            PRIVATE SPACE <span> / 私人空间</span>
          </div>
          <h1>
            记忆工作区
            <span className="mw-local">
              <Glyph name="lock" size={12} />
              仅本地
            </span>
          </h1>
          <p>把对话留存下来，让值得记住的事有迹可循。</p>
        </div>
        <div className="mw-header-actions">
          <button
            className="mw-button"
            disabled={disabled}
            onClick={(event) => {
              rememberActivator(event.currentTarget);
              setError('');
              fileRef.current?.click();
            }}
          >
            <Glyph name="upload" size={17} />
            导入文件
          </button>
          <button
            className="mw-button primary"
            disabled={disabled}
            onClick={() => open({ type: 'edit' })}
          >
            <Glyph name="plus" size={18} />
            新建记忆
          </button>
        </div>
      </header>
      <div className="mw-privacy">
        <Glyph name="lock" size={16} />
        <p>内容只保存在当前浏览器，不会上传或公开。清除浏览器数据会移除记录，请定期下载备份。</p>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".json,.md,.txt"
        className="mw-file-input"
        aria-label="选择导入文件"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) {
            try {
              await importText(await file.text(), file.name);
            } catch (issue) {
              setError(`无法读取文件：${errorLabel(issue)}`);
            }
          }
        }}
      />
      {error && !modal && (
        <div className="mw-feedback error" role="alert">
          {error}
          {!hydrated && (
            <button className="mw-text-button" onClick={() => void refresh()}>
              重试读取
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="mw-feedback" role="status">
          {notice}
        </div>
      )}
      <div className="mw-tabs" role="tablist" aria-label="工作区视图">
        {(
          [
            { id: 'memories', label: '记忆', count: library.memories.length, icon: 'memory' },
            {
              id: 'conversations',
              label: '对话',
              count: library.conversations.length,
              icon: 'chat',
            },
            { id: 'backup', label: '备份', icon: 'download' },
          ] as const
        ).map((item, index, items) => (
          <button
            key={item.id}
            id={`mw-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls={`mw-panel-${item.id}`}
            tabIndex={tab === item.id ? 0 : -1}
            onKeyDown={(event) => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : (index + (event.key === 'ArrowRight' ? 1 : -1) + items.length) %
                        items.length;
                activateTab(items[next].id);
                document.getElementById(`mw-tab-${items[next].id}`)?.focus();
              }
            }}
            onClick={() => activateTab(item.id)}
          >
            <Glyph name={item.icon} size={17} />
            {item.label}
            {'count' in item && <span>{item.count}</span>}
          </button>
        ))}
      </div>
      {!hydrated && !error && (
        <div className="mw-loading" role="status">
          正在读取本地记忆…
        </div>
      )}
      <section
        className="mw-panel"
        role="tabpanel"
        id={`mw-panel-${tab}`}
        aria-labelledby={`mw-tab-${tab}`}
        aria-busy={!hydrated}
      >
        {hydrated && tab === 'memories' && (
          <div className="mw-memory-layout">
            <div className="mw-library">
              <div className="mw-section-heading">
                <div>
                  <h2>我的记忆</h2>
                  <p>{activeCount} 条有效记忆 · 每一条都由你决定保留</p>
                </div>
                {library.memories.length > 0 && (
                  <button
                    className="mw-text-button"
                    disabled={disabled}
                    onClick={() =>
                      setSelected(
                        filtered
                          .filter((entry) => entry.status === 'active')
                          .map((entry) => entry.id),
                      )
                    }
                  >
                    选择当前有效记忆
                  </button>
                )}
              </div>
              {library.memories.length > 0 && (
                <div className="mw-filters">
                  <label className="mw-search">
                    <Glyph name="search" size={17} />
                    <input
                      aria-label="搜索记忆"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="搜索标题、摘要或标签"
                    />
                  </label>
                  <div className="mw-filter-row">
                    <select
                      aria-label="筛选记忆类型"
                      value={kind}
                      onChange={(event) => setKind(event.target.value)}
                    >
                      <option value="">全部类型</option>
                      {Object.entries(kindNames).map(([key, value]) => (
                        <option value={key} key={key}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label="筛选记忆状态"
                      value={status}
                      onChange={(event) => setStatus(event.target.value)}
                    >
                      <option value="active">有效记忆</option>
                      <option value="expired">已过期</option>
                      <option value="">全部状态</option>
                    </select>
                    <select
                      aria-label="筛选项目"
                      value={project}
                      onChange={(event) => setProject(event.target.value)}
                    >
                      <option value="">全部项目</option>
                      {projects.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                    <select
                      aria-label="筛选标签"
                      value={tag}
                      onChange={(event) => setTag(event.target.value)}
                    >
                      <option value="">全部标签</option>
                      {tags.map((item) => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mw-date-filters">
                    <label>
                      更新自
                      <input
                        type="date"
                        value={updatedFrom}
                        onChange={(event) => setUpdatedFrom(event.target.value)}
                        aria-invalid={Boolean(dateRangeError)}
                        aria-describedby={
                          dateRangeError ? 'mw-date-range-error mw-date-help' : 'mw-date-help'
                        }
                      />
                    </label>
                    <label>
                      更新至
                      <input
                        type="date"
                        value={updatedTo}
                        onChange={(event) => setUpdatedTo(event.target.value)}
                        aria-invalid={Boolean(dateRangeError)}
                        aria-describedby={
                          dateRangeError ? 'mw-date-range-error mw-date-help' : 'mw-date-help'
                        }
                      />
                    </label>
                  </div>
                  <p className="mw-date-help" id="mw-date-help">
                    按 UTC 日期筛选，包含起止当天；留空不限。
                  </p>
                  {dateRangeError && (
                    <div className="mw-feedback error" id="mw-date-range-error" role="alert">
                      {dateRangeError}
                    </div>
                  )}
                </div>
              )}
              {filtered.length ? (
                <div className="mw-cards">
                  {filtered.map((entry) => (
                    <article
                      className={`mw-card ${entry.status === 'expired' ? 'expired' : ''}`}
                      key={entry.id}
                    >
                      <div className="mw-card-top">
                        <span className={`mw-kind ${entry.kind}`}>{kindNames[entry.kind]}</span>
                        {entry.status === 'expired' && <span className="mw-expired">已过期</span>}
                        <label className="mw-select-card">
                          <input
                            type="checkbox"
                            aria-label={`选择记忆：${entry.title}`}
                            checked={selected.includes(entry.id) && entry.status === 'active'}
                            disabled={disabled || entry.status === 'expired'}
                            onChange={(event) =>
                              setSelected((ids) =>
                                event.target.checked
                                  ? [...ids, entry.id]
                                  : ids.filter((id) => id !== entry.id),
                              )
                            }
                          />
                          <span>加入上下文</span>
                        </label>
                      </div>
                      <h3>{entry.title}</h3>
                      <p className="mw-summary">{entry.summary}</p>
                      {(entry.project || entry.tags.length > 0) && (
                        <div className="mw-tags">
                          {entry.project && <span className="mw-project">{entry.project}</span>}
                          {entry.tags.map((tag) => (
                            <span key={tag}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      <div className="mw-card-footer">
                        <time dateTime={entry.updatedAt}>更新于 {dateLabel(entry.updatedAt)}</time>
                        <div>
                          <button
                            className="mw-text-button"
                            disabled={disabled}
                            onClick={() => open({ type: 'edit', entry })}
                            aria-label={`编辑记忆：${entry.title}`}
                          >
                            编辑
                          </button>
                          <button
                            className="mw-text-button danger"
                            disabled={disabled}
                            onClick={() =>
                              open({ type: 'delete', category: 'memory', item: entry })
                            }
                            aria-label={`删除记忆：${entry.title}`}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                      {entry.sourceRefs.length > 0 && (
                        <div className="mw-card-source">
                          <span>来源</span>
                          {entry.sourceRefs.map((ref) => {
                            const source = library.conversations.find(
                              (item) => item.id === ref.conversationId,
                            );
                            return (
                              source && (
                                <button
                                  key={source.id}
                                  className="mw-source-link"
                                  onClick={() => open({ type: 'view', conversation: source })}
                                >
                                  {source.title}
                                  <Glyph name="arrow" size={12} />
                                </button>
                              )
                            );
                          })}
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mw-empty">
                  <div className="mw-empty-icon">
                    <Glyph name="memory" size={28} />
                  </div>
                  <h3>{library.memories.length ? '没有匹配的记忆' : '让第一条记忆从这里开始'}</h3>
                  <p>
                    {library.memories.length
                      ? '换个关键词或调整筛选，找到想保留的那一条。'
                      : '记录一个事实、一项偏好，或一次值得回顾的决策。'}
                  </p>
                  <button
                    className="mw-button"
                    disabled={disabled}
                    onClick={() =>
                      library.memories.length
                        ? (setQuery(''),
                          setKind(''),
                          setStatus(''),
                          setProject(''),
                          setTag(''),
                          setUpdatedFrom(''),
                          setUpdatedTo(''))
                        : open({ type: 'edit' })
                    }
                  >
                    {library.memories.length ? '清除筛选' : '创建第一条记忆'}
                    <Glyph name="arrow" size={16} />
                  </button>
                </div>
              )}
            </div>
            <aside className={`mw-context${library.memories.length ? '' : ' is-empty'}`}>
              <div className="mw-context-heading">
                <div className="mw-eyebrow">CONTEXT</div>
                <h2>带上需要的记忆</h2>
                <p>选择有效记忆，整理成下一次对话的上下文。</p>
              </div>
              <div className="mw-context-meta">
                <span>已选 {selectedEntries.length} 条</span>
                {selectedEntries.length > 0 && (
                  <button className="mw-text-button" onClick={() => setSelected([])}>
                    清空选择
                  </button>
                )}
              </div>
              {selectedEntries.length ? (
                <pre className="mw-context-preview" aria-label="上下文预览">
                  {context}
                </pre>
              ) : (
                <div className="mw-context-empty">
                  <Glyph name="memory" size={25} />
                  <p>
                    在记忆卡片上勾选
                    <br />
                    「加入上下文」
                  </p>
                  <span>摘要、来源与更新时间会一并带上。</span>
                </div>
              )}
              <div className="mw-context-actions">
                <button
                  className="mw-button primary"
                  disabled={disabled || !selectedEntries.length}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(context);
                      setNotice('上下文已复制。');
                      setError('');
                    } catch {
                      setError('无法复制，请下载 Markdown，或手动选中上下文预览进行复制。');
                    }
                  }}
                >
                  复制上下文
                </button>
                <button
                  className="mw-button"
                  disabled={disabled || !selectedEntries.length}
                  onClick={() =>
                    download(context, 'memory-context.md', 'text/markdown;charset=utf-8')
                  }
                >
                  <Glyph name="download" size={16} />
                  下载 Markdown
                </button>
              </div>
              <p className="mw-context-note">已过期的记忆不会加入上下文。</p>
            </aside>
          </div>
        )}
        {hydrated && tab === 'conversations' && (
          <div className="mw-conversations">
            <div className="mw-section-heading">
              <div>
                <h2>对话档案</h2>
                <p>保留原始对话，随时回看记忆的来源。</p>
              </div>
              <button
                className="mw-button primary"
                disabled={disabled}
                onClick={() => open({ type: 'paste' })}
              >
                <Glyph name="plus" size={16} />
                粘贴对话
              </button>
            </div>
            <label className="mw-search">
              <Glyph name="search" size={17} />
              <input
                aria-label="搜索对话"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索对话标题或内容"
              />
            </label>
            {conversations.length ? (
              <div className="mw-conversation-list">
                {conversations.map((item) => (
                  <article className="mw-conversation-row" key={item.id}>
                    <div className="mw-conversation-icon">
                      <Glyph name="chat" />
                    </div>
                    <div className="mw-conversation-info">
                      <button
                        className="mw-conversation-title"
                        onClick={() => open({ type: 'view', conversation: item })}
                      >
                        {item.title}
                      </button>
                      <p>
                        {item.messages.length} 条消息 · {item.source || '本地对话'} ·{' '}
                        {dateLabel(item.updatedAt)}
                      </p>
                      <div className="mw-excerpt">{item.messages[0]?.content}</div>
                    </div>
                    <div className="mw-row-actions">
                      <button
                        className="mw-text-button"
                        disabled={disabled}
                        onClick={() => open({ type: 'edit', conversation: item })}
                        aria-label={`提炼记忆：${item.title}`}
                      >
                        提炼记忆
                      </button>
                      <button
                        className="mw-text-button danger"
                        disabled={disabled}
                        onClick={() => open({ type: 'delete', category: 'conversation', item })}
                        aria-label={`删除对话：${item.title}`}
                      >
                        删除
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mw-empty">
                <div className="mw-empty-icon">
                  <Glyph name="chat" size={28} />
                </div>
                <h3>
                  {library.conversations.length ? '没有匹配的对话' : '每条记忆，都可以有一个出处'}
                </h3>
                <p>
                  {library.conversations.length
                    ? '尝试其他关键词。'
                    : '粘贴一段对话，或导入 Markdown、TXT 文件，再提炼值得保留的内容。'}
                </p>
                <button
                  className="mw-button"
                  disabled={disabled}
                  onClick={() => open({ type: 'paste' })}
                >
                  粘贴一段对话
                  <Glyph name="arrow" size={16} />
                </button>
              </div>
            )}
          </div>
        )}
        {hydrated && tab === 'backup' && (
          <div className="mw-backup">
            <div className="mw-section-heading">
              <div>
                <h2>给记忆留一份备份</h2>
                <p>下载完整档案，或把之前的备份合并到当前浏览器。</p>
              </div>
            </div>
            <div className="mw-backup-grid">
              <article className="mw-backup-card">
                <div className="mw-empty-icon">
                  <Glyph name="download" size={25} />
                </div>
                <h3>导出完整备份</h3>
                <p>包含全部记忆、对话与来源关联，使用版本化 JSON 格式。</p>
                <div className="mw-backup-count">
                  <strong>{library.memories.length}</strong> 条记忆 <span>·</span>{' '}
                  <strong>{library.conversations.length}</strong> 段对话
                </div>
                <button
                  className="mw-button primary"
                  disabled={disabled}
                  onClick={() => {
                    download(
                      exportBackup(library),
                      `memory-backup-${new Date().toISOString().slice(0, 10)}.json`,
                      'application/json',
                    );
                    setNotice('备份文件已生成，请妥善保存。');
                  }}
                >
                  <Glyph name="download" size={16} />
                  下载 JSON 备份
                </button>
              </article>
              <article className="mw-backup-card">
                <div className="mw-empty-icon">
                  <Glyph name="upload" size={25} />
                </div>
                <h3>合并已有备份</h3>
                <p>先验证文件，再确认导入。同一条记录保留更新较新的版本，重复导入不会新增副本。</p>
                <div className="mw-backup-count muted">支持 .json · .md · .txt</div>
                <button
                  className="mw-button"
                  disabled={disabled}
                  onClick={(event) => {
                    rememberActivator(event.currentTarget);
                    fileRef.current?.click();
                  }}
                >
                  <Glyph name="upload" size={16} />
                  选择备份文件
                </button>
              </article>
            </div>
            <div className="mw-backup-note">
              <Glyph name="lock" size={18} />
              <div>
                <h3>这是一个本地工作区</h3>
                <p>
                  更换浏览器或设备时，请手动导出并导入备份。私人内容不会进入博客搜索，也不会自动发布到网站。
                </p>
              </div>
            </div>
          </div>
        )}
      </section>
      {modal && (
        <Dialog
          key={modal.type + (modal.type === 'edit' ? (modal.entry?.id ?? '') : '')}
          title={
            modal.type === 'edit'
              ? modal.entry
                ? '编辑记忆'
                : modal.conversation
                  ? '从对话提炼记忆'
                  : '新建记忆'
              : modal.type === 'paste'
                ? '粘贴对话'
                : modal.type === 'import'
                  ? '确认导入'
                  : modal.type === 'view'
                    ? '查看来源对话'
                    : '确认删除'
          }
          onClose={() => {
            if (!busy) setModal(null);
          }}
          returnFocus={returnFocusRef.current}
        >
          {error && (
            <div className="mw-feedback error" role="alert">
              {error}
              {!hydrated && (
                <button className="mw-text-button" onClick={() => void refresh()}>
                  重试读取
                </button>
              )}
            </div>
          )}
          {modal.type === 'edit' && (
            <MemoryEditor
              entry={modal.entry}
              conversation={modal.conversation}
              library={library}
              busy={busy}
              onSave={(entry) => void saveEntry(entry)}
              onCancel={() => setModal(null)}
            />
          )}
          {modal.type === 'paste' && (
            <form
              className="mw-form"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                const title = String(data.get('conversationTitle')).trim() || '粘贴的对话';
                void importText(String(data.get('conversationText')), `${title}.md`);
              }}
            >
              <label>
                对话标题
                <input
                  name="conversationTitle"
                  placeholder="例如：关于博客的讨论"
                  maxLength={200}
                  autoFocus
                />
              </label>
              <label>
                对话内容
                <textarea
                  name="conversationText"
                  rows={10}
                  required
                  placeholder={'## user\n我的问题\n\n## assistant\n助手的回复'}
                />
              </label>
              <p className="mw-help">
                用 ## user、## assistant、##
                system（或用户、助手、系统）分隔角色。普通文本会作为一条用户消息。
              </p>
              <div className="mw-dialog-actions">
                <button
                  type="button"
                  className="mw-button"
                  disabled={busy}
                  onClick={() => setModal(null)}
                >
                  取消
                </button>
                <button type="submit" className="mw-button primary" disabled={busy}>
                  {busy ? '验证中…' : '预览导入'}
                </button>
              </div>
            </form>
          )}
          {modal.type === 'import' && (
            <div className="mw-import-preview">
              <p className="mw-help">文件已通过验证。确认后才会写入当前浏览器。</p>
              <p className="mw-import-filename">{modal.filename}</p>
              <div className="mw-import-counts">
                <div>
                  <strong>{modal.library.memories.length}</strong>
                  <span>条记忆</span>
                </div>
                <div>
                  <strong>{modal.library.conversations.length}</strong>
                  <span>段对话</span>
                </div>
              </div>
              <p>将与当前记录合并。相同记录保留更新较新的版本，重复导入不会新增副本。</p>
              <div className="mw-dialog-actions">
                <button className="mw-button" disabled={busy} onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="mw-button primary"
                  disabled={busy}
                  onClick={async () => {
                    const incoming = modal.library;
                    const saved = await mutate(
                      (current) => mergeLibraries(current, incoming),
                      `已合并导入 ${incoming.memories.length} 条记忆、${incoming.conversations.length} 段对话；重复记录不会新增。`,
                    );
                    if (saved) {
                      setModal(null);
                      setTab(
                        incoming.conversations.length && !incoming.memories.length
                          ? 'conversations'
                          : 'memories',
                      );
                    }
                  }}
                >
                  {busy ? '导入中…' : '确认导入'}
                </button>
              </div>
            </div>
          )}
          {modal.type === 'view' && (
            <div className="mw-source-view">
              <h3>{modal.conversation.title}</h3>
              <p className="mw-help">
                {modal.conversation.source || '本地对话'} · 更新于{' '}
                {dateLabel(modal.conversation.updatedAt)}
              </p>
              <div className="mw-messages">
                {modal.conversation.messages.map((message) => (
                  <article
                    className={`mw-message ${message.role}`}
                    id={`message-${message.id}`}
                    key={message.id}
                  >
                    <span>{roleNames[message.role]}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>
              <div className="mw-dialog-actions">
                <button className="mw-button" onClick={() => setModal(null)}>
                  关闭
                </button>
                <button
                  className="mw-button primary"
                  disabled={disabled}
                  onClick={() => open({ type: 'edit', conversation: modal.conversation })}
                >
                  从此对话提炼记忆
                </button>
              </div>
            </div>
          )}
          {modal.type === 'delete' && (
            <div className="mw-delete">
              <p>确定删除「{modal.item.title}」吗？</p>
              <p className="mw-help">
                {modal.category === 'conversation'
                  ? '原始对话将被移除。关联的记忆卡片会保留，但与这段对话的来源关联会解除。此操作无法撤销。'
                  : '这条记忆将从本地库中移除。此操作无法撤销，来源对话会保留。'}
              </p>
              <div className="mw-dialog-actions">
                <button className="mw-button" disabled={busy} onClick={() => setModal(null)}>
                  取消
                </button>
                <button
                  className="mw-button destructive"
                  disabled={busy}
                  onClick={() => void confirmDelete(modal)}
                >
                  {busy ? '删除中…' : '确认删除'}
                </button>
              </div>
            </div>
          )}
        </Dialog>
      )}
    </div>
  );
}
