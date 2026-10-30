import React, { useEffect, useState } from 'react';
import { makeQrDataUrl } from '../lib/qr';

export default function RemoteAccessModal ({ open, onClose, info, t }) {
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

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
    setCopied(false);
    setQr(null);
    if (!open || !info || !info.url) return undefined;

    makeQrDataUrl(info.url, { width: 380 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    }).catch(() => {
      if (!cancelled) setQr(null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, info]);

  if (!open) return null;

  const copyUrl = async () => {
    if (!info || !info.url) return;
    try {
      await navigator.clipboard.writeText(info.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_error) {
      setCopied(false);
    }
  };

  const openUrl = () => {
    if (info && info.url && window.api && window.api.openExternal) {
      window.api.openExternal(info.url);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal remote-modal"
        role="dialog"
        aria-modal="true"
        aria-label={t('remote.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal__header">
          <h2>{t('remote.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('remote.close')}>
            ×
          </button>
        </div>

        <p className="muted">{t('remote.description')}</p>

        {!info || !info.ready ? (
          <div className="remote-starting">
            <span className="spinner" />
            <span>{t('remote.starting')}</span>
          </div>
        ) : (
          <>
            <div className="remote-qr">
              {qr ? <img className="qris-image" src={qr} alt={t('remote.qrAlt')} /> : <span className="spinner" />}
            </div>

            <div className="remote-url">
              <code>{info.url}</code>
            </div>

            <div className="modal__actions">
              <button type="button" className="button" onClick={copyUrl}>
                {copied ? t('remote.copied') : t('remote.copy')}
              </button>
              <button type="button" className="button button--primary" onClick={openUrl}>
                {t('remote.open')}
              </button>
            </div>

            {info.urls && info.urls.length > 1 ? (
              <div className="remote-alt">
                <span>{t('remote.otherAddresses')}</span>
                {info.urls.slice(1).map((url) => (
                  <code key={url}>{url}</code>
                ))}
              </div>
            ) : null}
          </>
        )}

        <p className="remote-note">{t('remote.networkNote')}</p>
      </div>
    </div>
  );
}
