import { useEffect } from 'react';
import Icon from './Icon';

export default function Modal({ title, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-light-on-surface/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-md bg-light-surface-container-lowest rounded-md shadow-[0_12px_40px_rgba(11,79,158,0.25)] flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-light-outline-variant">
          <h2 className="font-headline text-headline-sm text-light-on-surface">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-8 h-8 rounded-full hover:bg-light-surface-container flex items-center justify-center text-light-on-surface-variant cursor-pointer">
            <Icon name="close" className="text-title-md" />
          </button>
        </header>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">{children}</div>
        {footer && <footer className="flex justify-end gap-3 px-5 py-4 border-t border-light-outline-variant">{footer}</footer>}
      </div>
    </div>
  );
}
