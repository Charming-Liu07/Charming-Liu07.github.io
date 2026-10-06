import { useEffect, useRef, type ReactNode } from 'react';

export function Glyph({
  name,
  size = 20,
}: {
  name: 'plus' | 'memory' | 'chat' | 'download' | 'upload' | 'search' | 'lock' | 'arrow' | 'close';
  size?: number;
}) {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    memory: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="3" />
        <path d="M9 9h6M9 13h6M9 17h3" />
      </>
    ),
    chat: (
      <path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-3 3V11.5a7.5 7.5 0 0 1 7.5-7.5h3a7.5 7.5 0 0 1 7.5 7.5Z" />
    ),
    download: (
      <>
        <path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4m-5 5 5-5 5 5M4 17v4h16v-4" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}

export function Dialog({
  title,
  children,
  onClose,
  returnFocus,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  returnFocus: HTMLElement | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const firstField = dialog?.querySelector<HTMLElement>(
      'input:not([type="hidden"]), textarea, select',
    );
    (firstField ?? dialog?.querySelector<HTMLElement>('button'))?.focus();
    return () => {
      dialog?.close();
      queueMicrotask(() => {
        // A replacement dialog may open during the same React commit.
        if (document.querySelector('.mw-dialog[open]')) return;
        const target =
          returnFocus?.isConnected && !returnFocus.matches(':disabled')
            ? returnFocus
            : document.querySelector<HTMLElement>(
                '.mw-header-actions .primary:not(:disabled), .mw-tabs button[aria-selected="true"]',
              );
        target?.focus();
      });
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="mw-dialog"
      aria-labelledby="mw-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="mw-dialog-heading">
        <h2 id="mw-dialog-title">{title}</h2>
        <button className="mw-icon-button" aria-label="关闭对话框" onClick={onClose}>
          <Glyph name="close" />
        </button>
      </div>
      {children}
    </dialog>
  );
}
