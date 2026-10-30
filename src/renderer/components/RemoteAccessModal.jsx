import React, { useEffect, useState } from 'react';
import { makeQrDataUrl } from '../lib/qr';

export default function RemoteAccessModal ({ open, onClose, info, t }) {
  const [activeTab, setActiveTab] = useState('remote'); // 'remote' | 'output'
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

  const targetUrl = activeTab === 'remote' ? info?.url : info?.outputUrl;

  useEffect(() => {
    let cancelled = false;
    setCopied(false);
    setQr(null);
    if (!open || !targetUrl) return undefined;

    makeQrDataUrl(targetUrl, { width: 380 }).then((dataUrl) => {
      if (!cancelled) setQr(dataUrl);
    }).catch(() => {
      if (!cancelled) setQr(null);
    });

    return () => {
      cancelled = true;
    };
  }, [open, targetUrl]);

  if (!open) return null;

  const copyUrl = async () => {
    if (!targetUrl) return;
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_error) {
      setCopied(false);
    }
  };

  const openUrl = () => {
    if (targetUrl && window.api && window.api.openExternal) {
      window.api.openExternal(targetUrl);
    }
  };

  const altUrls = activeTab === 'remote' ? info?.urls : info?.outputUrls;

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
          <h2>{activeTab === 'remote' ? t('remote.title') : t('webOutput.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('remote.close')}>
            ×
          </button>
        </div>

        <div className="modal-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          <button
            type="button"
            className={`button ${activeTab === 'remote' ? 'button--primary' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('remote')}
          >
            {t('webOutput.tabRemote')}
          </button>
          <button
            type="button"
            className={`button ${activeTab === 'output' ? 'button--primary' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('output')}
          >
            {t('webOutput.tabOutput')}
          </button>
        </div>

        <p className="muted">
          {activeTab === 'remote' ? t('remote.description') : t('webOutput.description')}
        </p>

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
              <code>{targetUrl}</code>
            </div>

            {activeTab === 'output' ? (
              <p className="muted" style={{ fontSize: '11px', textAlign: 'center', margin: '4px 0 10px' }}>
                {t('webOutput.transparentHint')}
              </p>
            ) : null}

            <div className="modal__actions">
              <button type="button" className="button" onClick={copyUrl}>
                {copied ? t('remote.copied') : t('remote.copy')}
              </button>
              <button type="button" className="button button--primary" onClick={openUrl}>
                {t('remote.open')}
              </button>
            </div>

            {altUrls && altUrls.length > 1 ? (
              <div className="remote-alt">
                <span>{t('remote.otherAddresses')}</span>
                {altUrls.slice(1).map((url) => (
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
