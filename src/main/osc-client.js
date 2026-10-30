const dgram = require('dgram');

let socket = null;
let lastStatus = null;

function getSocket () {
  if (!socket) {
    socket = dgram.createSocket('udp4');
    socket.unref();
  }
  return socket;
}

function padBuffer (buffer) {
  const remainder = buffer.length % 4;
  if (remainder === 0) return buffer;
  return Buffer.concat([buffer, Buffer.alloc(4 - remainder)]);
}

function oscString (value) {
  return padBuffer(Buffer.from(`${value}\0`, 'utf8'));
}

function oscInt (value) {
  const buffer = Buffer.alloc(4);
  buffer.writeInt32BE(Math.trunc(value), 0);
  return buffer;
}

function oscFloat (value) {
  const buffer = Buffer.alloc(4);
  buffer.writeFloatBE(value, 0);
  return buffer;
}

function encodeMessage (address, args) {
  let tags = ',';
  const payload = [];

  for (const arg of args) {
    if (typeof arg === 'string') {
      tags += 's';
      payload.push(oscString(arg));
    } else if (typeof arg === 'number') {
      if (Number.isInteger(arg)) {
        tags += 'i';
        payload.push(oscInt(arg));
      } else {
        tags += 'f';
        payload.push(oscFloat(arg));
      }
    }
  }

  return Buffer.concat([oscString(address), oscString(tags), ...payload]);
}

function normalizeEndpoint (settings = {}) {
  const host = String(settings.oscHost || settings.host || '127.0.0.1')
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '');
  const port = Number(settings.oscPort) || 7000;
  return { host, port };
}

function send (settings, addresses, text) {
  return new Promise((resolve, reject) => {
    const { host, port } = normalizeEndpoint(settings);
    const list = (Array.isArray(addresses) ? addresses : [addresses]).filter(Boolean);

    if (list.length === 0) {
      const error = new Error('No OSC address configured');
      lastStatus = { ok: false, host, port, error: error.message, at: Date.now() };
      reject(error);
      return;
    }

    try {
      const client = getSocket();
      const buffers = list.map((address) => encodeMessage(address, [String(text)]));
      let remaining = buffers.length;
      const onSent = (error) => {
        if (error) {
          lastStatus = { ok: false, host, port, error: error.message, at: Date.now() };
          reject(error);
          return;
        }
        remaining -= 1;
        if (remaining === 0) {
          lastStatus = { ok: true, host, port, at: Date.now() };
          resolve({ host, port, addresses: list });
        }
      };

      for (const buffer of buffers) {
        client.send(buffer, 0, buffer.length, port, host, onSent);
      }
    } catch (error) {
      lastStatus = { ok: false, host, port, error: error.message, at: Date.now() };
      reject(error);
    }
  });
}

function getStatus (settings = {}) {
  if (!lastStatus) return null;
  const { host, port } = normalizeEndpoint(settings);
  if (lastStatus.host !== host || lastStatus.port !== port) return null;
  return { ...lastStatus };
}

function close () {
  if (socket) {
    try {
      socket.close();
    } catch (_error) {
      // ignore close errors
    }
    socket = null;
  }
}

module.exports = { send, getStatus, encodeMessage, close };
