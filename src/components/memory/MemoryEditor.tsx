import { useState, type SubmitEvent } from 'react';
import type {
  Conversation,
  Library,
  MemoryEntry,
  MemoryKind,
  MemoryStatus,
} from '../../lib/memory/types';

export const kindNames: Record<MemoryKind, string> = {
  fact: '事实',
  preference: '偏好',
  decision: '决策',
  learning: '经验',
};

export default function MemoryEditor({
  entry,
  conversation,
  library,
  busy,
  onSave,
  onCancel,
}: {
  entry?: MemoryEntry;
  conversation?: Conversation;
  library: Library;
  busy: boolean;
  onSave: (entry: MemoryEntry) => void;
  onCancel: () => void;
}) {
  const [sourceIds, setSourceIds] = useState<string[]>(
    entry?.sourceRefs.map((ref) => ref.conversationId) ?? (conversation ? [conversation.id] : []),
  );
  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    onSave({
      id: entry?.id ?? crypto.randomUUID(),
      title: String(data.get('title')).trim(),
      summary: String(data.get('summary')).trim(),
      kind: data.get('kind') as MemoryKind,
      project: String(data.get('project')).trim(),
      tags: [
        ...new Set(
          String(data.get('tags'))
            .split(/[,，]/)
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ],
      status: data.get('status') as MemoryStatus,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
      sourceRefs: sourceIds.map(
        (id) =>
          entry?.sourceRefs.find((ref) => ref.conversationId === id) ?? {
            conversationId: id,
            messageIds:
              library.conversations
                .find((item) => item.id === id)
                ?.messages.map((message) => message.id) ?? [],
          },
      ),
    });
  }
  return (
    <form onSubmit={submit} className="mw-form">
      <label>
        标题
        <input
          name="title"
          required
          maxLength={200}
          defaultValue={entry?.title ?? ''}
          placeholder="一句话概括这条记忆"
          autoFocus
        />
      </label>
      <label>
        摘要
        <textarea
          name="summary"
          required
          rows={5}
          defaultValue={entry?.summary ?? ''}
          placeholder="记录值得保留的事实、偏好、决策或经验。"
        />
      </label>
      <div className="mw-form-grid">
        <label>
          类型
          <select name="kind" defaultValue={entry?.kind ?? 'fact'}>
            {Object.entries(kindNames).map(([key, value]) => (
              <option value={key} key={key}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          状态
          <select name="status" defaultValue={entry?.status ?? 'active'}>
            <option value="active">有效</option>
            <option value="expired">已过期</option>
          </select>
        </label>
      </div>
      <label>
        项目
        <input
          name="project"
          defaultValue={entry?.project ?? ''}
          placeholder="可选，例如：个人博客"
        />
      </label>
      <label>
        标签
        <input
          name="tags"
          defaultValue={entry?.tags.join(', ') ?? ''}
          placeholder="用逗号分隔，例如：写作, 工作习惯"
        />
      </label>
      <fieldset className="mw-sources">
        <legend>
          来源对话 <span>（可选）</span>
        </legend>
        {library.conversations.length ? (
          library.conversations.map((item) => (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={sourceIds.includes(item.id)}
                onChange={(event) =>
                  setSourceIds((ids) =>
                    event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id),
                  )
                }
              />
              {item.title}
            </label>
          ))
        ) : (
          <p>还没有对话，可以先保存记忆，之后再关联来源。</p>
        )}
      </fieldset>
      <p className="mw-help">已过期的记忆保留在库中，不会加入上下文。</p>
      <div className="mw-dialog-actions">
        <button type="button" className="mw-button" onClick={onCancel} disabled={busy}>
          取消
        </button>
        <button type="submit" className="mw-button primary" disabled={busy}>
          {busy ? '保存中…' : '保存记忆'}
        </button>
      </div>
    </form>
  );
}
