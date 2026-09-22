import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  actionText?: string;
  onAction?: () => void;
}

interface ToastContextValue {
  toast: (options: Omit<ToastItem, 'id'>) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string, actionText?: string, onAction?: () => void) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, type = 'info', duration = 5000, actionText, onAction }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, title, description, type, duration, actionText, onAction };
      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, description?: string) => toast({ title, description, type: 'success' }), [toast]);
  const warning = useCallback((title: string, description?: string) => toast({ title, description, type: 'warning' }), [toast]);
  const error = useCallback((title: string, description?: string, actionText?: string, onAction?: () => void) => {
    toast({ title, description, type: 'error', duration: 7000, actionText, onAction });
  }, [toast]);
  const info = useCallback((title: string, description?: string) => toast({ title, description, type: 'info' }), [toast]);

  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-destructive shrink-0" />,
    info: <Info className="h-5 w-5 text-sky-600 dark:text-sky-400 shrink-0" />,
  };

  const borders = {
    success: 'border-emerald-500/30 bg-card text-card-foreground shadow-lg shadow-emerald-500/5',
    warning: 'border-amber-500/30 bg-card text-card-foreground shadow-lg shadow-amber-500/5',
    error: 'border-destructive/40 bg-card text-card-foreground shadow-lg shadow-destructive/10',
    info: 'border-sky-500/30 bg-card text-card-foreground shadow-lg shadow-sky-500/5',
  };

  return (
    <ToastContext.Provider value={{ toast, success, warning, error, info }}>
      {children}
      {/* Toast container */}
      <div
        aria-live="assertive"
        className="pointer-events-none fixed bottom-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse p-4 sm:max-w-md gap-3"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-md transition-all animate-in slide-in-from-right-full duration-300',
              borders[t.type]
            )}
            role="alert"
          >
            {icons[t.type]}
            <div className="flex-1">
              <h4 className="text-sm font-semibold leading-tight">{t.title}</h4>
              {t.description && (
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  {t.description}
                </p>
              )}
              {t.actionText && t.onAction && (
                <button
                  onClick={() => {
                    t.onAction?.();
                    removeToast(t.id);
                  }}
                  className="mt-2 text-xs font-semibold text-primary underline underline-offset-2 hover:opacity-80"
                >
                  {t.actionText}
                </button>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="text-muted-foreground/60 hover:text-foreground p-1 transition-colors rounded"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Đóng</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
