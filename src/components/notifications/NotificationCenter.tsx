// src/components/notifications/NotificationCenter.tsx
/**
 * A floating bell in the top-right of the phone frame. Shows an unread badge,
 * opens a panel listing notifications (newest first) with mark-read / dismiss,
 * and holds the single permission toggle that enables OS toasts.
 */
import { useState } from 'react';
import { es } from '@/data/i18n/es';
import { useNotificationStore, unreadCount } from '@/store/useNotificationStore';

/** Browser permission state, or 'unsupported' where the Notification API is absent. */
function currentPermission(): NotificationPermission | 'unsupported' {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(currentPermission);
  const notifications = useNotificationStore((s) => s.notifications);
  const { markRead, dismiss } = useNotificationStore((s) => s.actions);

  const visible = notifications.filter((n) => n.status !== 'dismissed');
  const unread = unreadCount(notifications);

  // Only offer the toggle when the browser can still be asked (permission ===
  // 'default'); once granted/denied the prompt is a no-op, so we hide it.
  const canEnableToasts = permission === 'default';

  const enableToasts = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return;
    void Notification.requestPermission().then((result) => setPermission(result));
  };

  return (
    <div className="absolute right-3 top-3 z-30">
      <button
        type="button"
        aria-label={es.notifications.bell}
        onClick={() => setOpen((v) => !v)}
        className="relative grid h-10 w-10 place-items-center rounded-full bg-bg-base/90 text-lg shadow-soft-xl backdrop-blur"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="mt-2 max-h-[60vh] w-72 overflow-y-auto rounded-lg border border-border bg-bg-base p-2 shadow-soft-xl">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-bold text-text-primary">{es.notifications.bell}</p>
            {canEnableToasts && (
              <button
                type="button"
                onClick={enableToasts}
                className="text-xs font-semibold text-deep-blue"
              >
                {es.notifications.enable}
              </button>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-text-secondary">
              {es.notifications.empty}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((n) => (
                <li
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`rounded-md px-2 py-2 ${
                    n.status === 'read' ? 'bg-bg-base' : 'bg-bg-sunken'
                  } ${n.severity === 'urgent' ? 'border-l-2 border-danger' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                      <p className="text-xs text-text-secondary">{n.body}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={es.notifications.dismiss}
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      className="shrink-0 text-text-tertiary"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
