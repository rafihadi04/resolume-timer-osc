import QRCode from 'qrcode';

export async function makeQrDataUrl (text, options = {}) {
  if (!text) return null;
  return QRCode.toDataURL(String(text), {
    width: 360,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0b0f14',
      light: '#ffffff'
    },
    ...options
  });
}
