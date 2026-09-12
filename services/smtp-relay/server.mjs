import net from 'node:net';
import tls from 'node:tls';
import { SMTPServer } from 'smtp-server';

const MAX_MESSAGE_SIZE = 26_214_400;
const CONNECT_TIMEOUT_MS = 30_000;
const TRANSACTION_TIMEOUT_MS = 120_000;

const listenHost = process.env.SMTP_LISTEN_HOST || '0.0.0.0';
const listenPort = parsePort(process.env.SMTP_LISTEN_PORT || '2526', 'SMTP_LISTEN_PORT');
const upstreamHost = process.env.RELAY_SMTP_HOST || 'mail.smtp2go.com';
const upstreamPort = parsePort(process.env.RELAY_SMTP_PORT || '2525', 'RELAY_SMTP_PORT');
const upstreamTLSMode = (process.env.RELAY_SMTP_TLS_MODE || 'starttls').toLowerCase();
const upstreamUsername = process.env.RELAY_SMTP_USERNAME;
const upstreamPassword = process.env.RELAY_SMTP_PASSWORD;
const senderAddress = (process.env.SENDER_ADDRESS || 'noreply@realgo.dev').toLowerCase();
const allowedPrefixes = (process.env.ALLOWED_CLIENT_PREFIXES || '127.,::1,10.,172.,192.168.')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!upstreamUsername || !upstreamPassword) {
  throw new Error('RELAY_SMTP_USERNAME and RELAY_SMTP_PASSWORD are required');
}
if (!['starttls', 'implicit'].includes(upstreamTLSMode)) {
  throw new Error('RELAY_SMTP_TLS_MODE must be starttls or implicit');
}

function parsePort(value, name) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be a valid TCP port`);
  }
  return port;
}

class UpstreamSMTPError extends Error {
  constructor(stage, response, cause) {
    const code = /^\d{3}/.exec(response || '')?.[0] || '';
    super(`upstream SMTP ${stage} failed${code ? ` (${code})` : ''}`, { cause });
    this.name = 'UpstreamSMTPError';
    this.stage = stage;
    this.code = code;
    this.category = smtpFailureCategory(stage, code);
    this.retryable = this.category === 'temporary_provider_error';
  }
}

export function smtpFailureCategory(stage, code) {
  if (stage === 'AUTH' || stage === 'CONFIG') return 'configuration_or_authentication_error';
  if (code.startsWith('4')) return 'temporary_provider_error';
  if (code.startsWith('5')) return 'permanent_rejection';
  return 'transport_error';
}

function responseReader(socket) {
  let buffer = '';
  const waiters = [];
  const consume = () => {
    const lines = buffer.split('\r\n');
    for (let end = 0; end < lines.length - 1; end += 1) {
      if (/^\d{3} /.test(lines[end])) {
        const response = lines.slice(0, end + 1).join('\r\n');
        buffer = lines.slice(end + 1).join('\r\n');
        waiters.shift()?.resolve(response);
        return consume();
      }
    }
  };
  socket.on('data', (chunk) => {
    buffer += chunk.toString('utf8');
    consume();
  });
  socket.on('error', (error) => waiters.shift()?.reject(error));
  return () => new Promise((resolve, reject) => {
    waiters.push({ resolve, reject });
    consume();
  });
}

function expect(response, code, stage) {
  if (!response.startsWith(code)) throw new UpstreamSMTPError(stage, response);
}

function dotStuff(raw) {
  let message = raw.toString('latin1').replace(/\r?\n/g, '\r\n');
  message = message.replace(/(^|\r\n)\./g, '$1..');
  if (!message.endsWith('\r\n')) message += '\r\n';
  return Buffer.from(`${message}.\r\n`, 'latin1');
}

function connectUpstream() {
  if (upstreamTLSMode === 'implicit') {
    return tls.connect({ host: upstreamHost, port: upstreamPort, servername: upstreamHost, rejectUnauthorized: true });
  }
  return net.connect(upstreamPort, upstreamHost);
}

async function upgradeStartTLS(plain) {
  plain.removeAllListeners('data');
  plain.removeAllListeners('error');
  const secure = tls.connect({ socket: plain, servername: upstreamHost, rejectUnauthorized: true });
  await new Promise((resolve, reject) => {
    secure.once('secureConnect', resolve);
    secure.once('error', reject);
  });
  return secure;
}

async function sendViaSMTP2GO({ from, to, raw }) {
  let socket = connectUpstream();
  socket.setTimeout(CONNECT_TIMEOUT_MS, () => socket.destroy(new Error('SMTP connection timeout')));
  let read = responseReader(socket);
  try {
    if (upstreamTLSMode === 'implicit') {
      await new Promise((resolve, reject) => {
        socket.once('secureConnect', resolve);
        socket.once('error', reject);
      });
    }
    expect(await read(), '220', 'GREETING');
    socket.write('EHLO realgo.dev\r\n');
    expect(await read(), '250', 'EHLO');

    if (upstreamTLSMode === 'starttls') {
      socket.write('STARTTLS\r\n');
      expect(await read(), '220', 'STARTTLS');
      socket = await upgradeStartTLS(socket);
      socket.setTimeout(TRANSACTION_TIMEOUT_MS, () => socket.destroy(new Error('SMTP transaction timeout')));
      read = responseReader(socket);
      socket.write('EHLO realgo.dev\r\n');
      expect(await read(), '250', 'SECURE_EHLO');
    }

    const authToken = Buffer.from(`\0${upstreamUsername}\0${upstreamPassword}`).toString('base64');
    socket.write(`AUTH PLAIN ${authToken}\r\n`);
    expect(await read(), '235', 'AUTH');
    socket.write(`MAIL FROM:<${from}>\r\n`);
    expect(await read(), '250', 'MAIL_FROM');
    for (const recipient of to) {
      socket.write(`RCPT TO:<${recipient}>\r\n`);
      expect(await read(), '250', 'RCPT_TO');
    }
    socket.write('DATA\r\n');
    expect(await read(), '354', 'DATA');
    socket.write(dotStuff(raw));
    const queued = await read();
    expect(queued, '250', 'MESSAGE');
    socket.write('QUIT\r\n');
    socket.end();
    return { code: queued.slice(0, 3) };
  } catch (error) {
    socket.destroy();
    if (error instanceof UpstreamSMTPError) throw error;
    throw new UpstreamSMTPError('TRANSPORT', '', error);
  }
}

async function sendWithBoundedRetry(message) {
  try {
    return await sendViaSMTP2GO(message);
  } catch (error) {
    // SMTP 4xx explicitly says the provider did not accept this transaction.
    // Retry exactly once; a transport loss after DATA is intentionally not
    // retried because acceptance could be ambiguous and duplicate reset
    // messages are worse than a visible, logged failure.
    if (!error.retryable) throw error;
    await new Promise((resolve) => setTimeout(resolve, 250));
    return sendViaSMTP2GO(message);
  }
}

function clientAllowed(remoteAddress) {
  const address = remoteAddress?.replace(/^::ffff:/, '') || '';
  return allowedPrefixes.some((prefix) => address.startsWith(prefix));
}

const server = new SMTPServer({
  name: 'mail-relay.realgo.internal',
  banner: 'ReAlgo SMTP2GO outbound relay',
  hideSTARTTLS: true,
  disabledCommands: ['AUTH'],
  authOptional: true,
  size: MAX_MESSAGE_SIZE,
  onConnect(session, callback) {
    if (!clientAllowed(session.remoteAddress)) return callback(new Error('Client not permitted'));
    return callback();
  },
  onMailFrom(address, session, callback) {
    if (address.address.toLowerCase() !== senderAddress) return callback(new Error('Sender not permitted'));
    return callback();
  },
  onData(stream, session, callback) {
    const chunks = [];
    let size = 0;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size <= MAX_MESSAGE_SIZE) chunks.push(chunk);
    });
    stream.on('error', callback);
    stream.on('end', async () => {
      if (size > MAX_MESSAGE_SIZE) return callback(new Error('Message too large'));
      try {
        const result = await sendWithBoundedRetry({
          from: session.envelope.mailFrom.address,
          to: session.envelope.rcptTo.map(({ address }) => address),
          raw: Buffer.concat(chunks),
        });
        console.log(JSON.stringify({ event: 'relay_provider_accepted', provider: 'smtp2go', recipients: session.envelope.rcptTo.length, smtp_code: result.code }));
        return callback(null, 'Queued by SMTP2GO');
      } catch (error) {
        const category = error instanceof UpstreamSMTPError ? error.category : 'transport_error';
        const code = error instanceof UpstreamSMTPError ? error.code : '';
        console.error(JSON.stringify({ event: 'relay_provider_failed', provider: 'smtp2go', category, smtp_code: code || undefined, recipients: session.envelope.rcptTo.length }));
        return callback(error);
      }
    });
  },
});

server.on('error', (error) => {
  console.error(JSON.stringify({ event: 'relay_server_error', message: error.message }));
});

server.listen(listenPort, listenHost, () => {
  console.log(JSON.stringify({ event: 'relay_ready', provider: 'smtp2go', upstream_host: upstreamHost, upstream_port: upstreamPort, upstream_tls_mode: upstreamTLSMode, port: listenPort }));
});
