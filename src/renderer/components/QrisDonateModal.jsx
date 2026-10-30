import React, { useEffect, useState } from 'react';
import { makeQrDataUrl } from '../lib/qr';

const QR_STATIC = String(
  (import.meta.env.VITE_QR_STATIC || import.meta.env.VITE_QRIS_STATIC || '')
).trim();

const IS_IMAGE_SOURCE = /^(https?:|data:|\.{0,2}\/)/i.test(QR_STATIC);

export default function QrisDonateModal ({ open, onClose, t }) {
  const [qr, setQr] = useState(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    let cancelled = false;
    setQr(null);

    if (!open || !QR_STATIC) return undefined;
    if (IS_IMAGE_SOURCE) {
      setQr(QR_STATIC);
      return undefined;
    }

    makeQrDataUrl(QR_STATIC, { width: 420, margin: 2 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    }).catch(() => {
      if (!cancelled) setQr(null);
    });

    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('donate.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{t('donate.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('donate.close')}>
            ×
          </button>
        </div>

        <p className="muted">{t('donate.description')}</p>
        <p className="donate-note">{t('donate.onlyQris')}</p>

        {qr ? (
          <img className="qris-image" src={qr} alt={t('donate.qrAlt')} />
        ) : QR_STATIC ? (
          <div className="qr-missing">
            <span className="spinner" />
            <span>{t('donate.generating')}</span>
          </div>
        ) : (
          <div className="qr-missing">{t('donate.notConfigured')}</div>
        )}

        <div className="modal__actions">
          <button type="button" className="button button--primary" onClick={onClose}>
            {t('donate.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
