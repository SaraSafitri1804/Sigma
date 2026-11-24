import { createContext, useCallback, useContext, useState } from 'react';
import Icon from './Icon';

const ToastContext = createContext(() => {});

const TONES = {
  success: { icon: 'check_circle', cls: 'bg-status-valid-container text-on-status-valid-container border-status-valid/30' },
  error: { icon: 'error', cls: 'bg-status-revoked-container text-on-status-revoked-container border-status-revoked/30' },
  info: { icon: 'info', cls: 'bg-light-primary-container text-light-on-primary-container border-brand-blue/30' },
};

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);

  const push = useCallback((message, tone = 'success') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 flex flex-col gap-2 sm:w-96" aria-live="polite">
        {items.map((t) => {
          const s = TONES[t.tone] || TONES.info;
          return (
            <div key={t.id} role="status" className={`flex items-start gap-2.5 rounded-md border px-4 py-3 shadow-[0_8px_24px_rgba(11,79,158,0.18)] ${s.cls}`}>
              <Icon name={s.icon} className="text-title-md mt-0.5" fill />
              <span className="font-body text-body-sm">{t.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
