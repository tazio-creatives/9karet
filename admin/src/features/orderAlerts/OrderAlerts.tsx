import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchNewPaidOrders, type NewPaidOrder } from '../../api/orders';
import { formatPrice } from '../../utils/formatPrice';
import { isAudioUnlocked, playOrderChime, unlockAudio } from './chime';
import styles from './OrderAlerts.module.css';

const POLL_MS = 15_000;
const TOAST_MS = 20_000;
const SOUND_KEY = 'boxd-order-alert-sound';

function readSoundPref() {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

function showDesktopNotification(order: NewPaidOrder) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const n = new Notification(`New order ${order.orderNumber}`, {
    body: `${order.contactName} · ${formatPrice(order.totalAmount)}`,
    tag: `order-${order.id}`,
    icon: '/images/logo-sidebar.png',
  });
  n.onclick = () => {
    window.focus();
    window.location.assign(`/orders/${order.id}`);
  };
}

// New paid-order alerts for admins with Orders access: polls the backend,
// then rings, pops a toast, raises a desktop notification and counts unread
// orders on the bell. Only orders confirmed while admin is open alert.
export function OrderAlerts() {
  const [orders, setOrders] = useState<NewPaidOrder[]>([]);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<NewPaidOrder[]>([]);
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [audioReady, setAudioReady] = useState(false);
  const [notifyPermission, setNotifyPermission] = useState(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );
  const sinceRef = useRef<string | null>(null);
  const soundOnRef = useRef(soundOn);
  soundOnRef.current = soundOn;

  // Browsers allow sound only after a click: unlock on the first one anywhere.
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      setTimeout(() => setAudioReady(isAudioUnlocked()), 50);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetchNewPaidOrders(sinceRef.current ?? undefined);
        if (cancelled) return;
        const isFirst = sinceRef.current === null;
        sinceRef.current = res.serverTime;
        if (!isFirst && res.orders.length > 0) {
          setOrders((prev) => [...res.orders.slice().reverse(), ...prev].slice(0, 30));
          setUnread((n) => n + res.orders.length);
          setToasts((prev) => [...res.orders, ...prev].slice(0, 3));
          if (soundOnRef.current) playOrderChime();
          if (document.hidden) res.orders.forEach(showDesktopNotification);
          document.title = `(${res.orders.length}) New order — Box Diamonds Admin`;
        }
      } catch {
        // Network blip or logged out — try again next tick.
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  // Toasts disappear on their own after a while.
  useEffect(() => {
    if (toasts.length === 0) return;
    const t = setTimeout(() => setToasts((prev) => prev.slice(0, -1)), TOAST_MS);
    return () => clearTimeout(t);
  }, [toasts]);

  function toggleSound() {
    const next = !soundOn;
    setSoundOn(next);
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off');
    } catch {
      /* preference just won't persist */
    }
    if (next) {
      unlockAudio();
      setTimeout(() => {
        setAudioReady(isAudioUnlocked());
        playOrderChime(); // preview
      }, 60);
    }
  }

  async function enableDesktop() {
    if (typeof Notification === 'undefined') return;
    setNotifyPermission(await Notification.requestPermission());
  }

  function openPanel() {
    setOpen((v) => !v);
    setUnread(0);
    document.title = 'Box Diamonds Admin';
  }

  return (
    <>
      <div className={styles.bellWrap}>
        <button
          type="button"
          className={styles.bell}
          onClick={openPanel}
          aria-label={unread ? `${unread} new orders` : 'Order notifications'}
          aria-expanded={open}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unread > 0 && <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>}
        </button>

        {open && (
          <div className={styles.panel} role="dialog" aria-label="Order notifications">
            <div className={styles.panelHeader}>
              <strong>New orders</strong>
              <button type="button" className={styles.linkButton} onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
            <div className={styles.settings}>
              <label className={styles.setting}>
                <input type="checkbox" checked={soundOn} onChange={toggleSound} />
                Ringtone for new orders
              </label>
              {soundOn && !audioReady && <p className={styles.hint}>Click anywhere on the page once to allow sound.</p>}
              {notifyPermission === 'default' && (
                <button type="button" className={styles.linkButton} onClick={enableDesktop}>
                  Enable desktop notifications
                </button>
              )}
              {notifyPermission === 'denied' && (
                <p className={styles.hint}>Desktop notifications are blocked in this browser&apos;s site settings.</p>
              )}
            </div>
            {orders.length === 0 ? (
              <p className={styles.empty}>No new orders since you opened admin.</p>
            ) : (
              <ul className={styles.list}>
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link to={`/orders/${o.id}`} className={styles.item} onClick={() => setOpen(false)}>
                      <span className={styles.itemTop}>
                        <strong>{o.orderNumber}</strong>
                        <span>{formatPrice(o.totalAmount)}</span>
                      </span>
                      <span className={styles.itemMeta}>
                        {o.contactName} ·{' '}
                        {new Date(o.confirmedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className={styles.toasts} aria-live="polite">
        {!open && toasts.map((o) => (
          <div key={o.id} className={styles.toast}>
            <span className={styles.toastIcon} aria-hidden="true">
              🛍
            </span>
            <Link to={`/orders/${o.id}`} className={styles.toastBody} onClick={() => setToasts((t) => t.filter((x) => x.id !== o.id))}>
              <strong>New order {o.orderNumber}</strong>
              <span>
                {o.contactName} · {formatPrice(o.totalAmount)}
              </span>
            </Link>
            <button
              type="button"
              className={styles.toastClose}
              aria-label="Dismiss"
              onClick={() => setToasts((t) => t.filter((x) => x.id !== o.id))}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
