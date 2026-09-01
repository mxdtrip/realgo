import net from 'node:net';
import tls from 'node:tls';
import { SMTPServer } from 'smtp-server';

const listenHost = process.env.SMTP_LISTEN_HOST || '0.0.0.0';
const listenPort = Number.parseInt(process.env.SMTP_LISTEN_PORT || '2526', 10);
const gmailHost = process.env.GMAIL_SMTP_HOST || 'smtp.gmail.com';
const gmailPort = Number.parseInt(process.env.GMAIL_SMTP_PORT || '587', 10);
const gmailUsername = process.env.GMAIL_SMTP_USERNAME;
const gmailPassword = process.env.GMAIL_SMTP_PASSWORD;
const senderAddress = (process.env.SENDER_ADDRESS || 'support@realgo.dev').toLowerCase();
const allowedPrefixes = (process.env.ALLOWED_CLIENT_PREFIXES || '127.,::1,10.,172.,192.168.')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

if (!gmailUsername || !gmailPassword) {
  throw new Error('GMAIL_SMTP_USERNAME and GMAIL_SMTP_PASSWORD are required');
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
  if (!response.startsWith(code)) {
    throw new Error(`${stage} rejected with SMTP ${response.slice(0, 3)}`);
  }
}

function sanitize(response) {
  return response.replace(/\s+/g, ' ').slice(0, 240);
}

function dotStuff(raw) {
  let message = raw.toString('latin1').replace(/\r?\n/g, '\r\n');
  message = message.replace(/(^|\r\n)\./g, '$1..');
  if (!message.endsWith('\r\n')) message += '\r\n';
  return Buffer.from(`${message}.\r\n`, 'latin1');
}

async function sendViaGmail({ from, to, raw }) {
  const plain = net.connect(gmailPort, gmailHost);
  plain.setTimeout(30_000, () => plain.destroy(new Error('Gmail SMTP connect timeout')));

  let read = responseReader(plain);
  expect(await read(), '220', 'greeting');
  plain.write('EHLO realgo.dev\r\n');
  expect(await read(), '250', 'EHLO');
  plain.write('STARTTLS\r\n');
  expect(await read(), '220', 'STARTTLS');
  plain.removeAllListeners('data');
  plain.removeAllListeners('error');

  const secure = tls.connect({ socket: plain, servername: gmailHost, rejectUnauthorized: true });
  secure.setTimeout(120_000, () => secure.destroy(new Error('Gmail SMTP transaction timeout')));
  await new Promise((resolve, reject) => {
    secure.once('secureConnect', resolve);
    secure.once('error', reject);
  });

  read = responseReader(secure);
  secure.write('EHLO realgo.dev\r\n');
  expect(await read(), '250', 'secure EHLO');
  const token = Buffer.from(`\0${gmailUsername}\0${gmailPassword}`).toString('base64');
  secure.write(`AUTH PLAIN ${token}\r\n`);
  expect(await read(), '235', 'AUTH');
  secure.write(`MAIL FROM:<${from}>\r\n`);
  expect(await read(), '250', 'MAIL FROM');
  for (const recipient of to) {
    secure.write(`RCPT TO:<${recipient}>\r\n`);
    expect(await read(), '250', 'RCPT TO');
  }
  secure.write('DATA\r\n');
  expect(await read(), '354', 'DATA');
  secure.write(dotStuff(raw));
  const queued = await read();
  expect(queued, '250', 'message');
  secure.write('QUIT\r\n');
  secure.end();
  return sanitize(queued);
}

function clientAllowed(remoteAddress) {
  const address = remoteAddress?.replace(/^::ffff:/, '') || '';
  return allowedPrefixes.some((prefix) => address.startsWith(prefix));
}

const server = new SMTPServer({
  name: 'mail-relay.realgo.internal',
  banner: 'ReAlgo Gmail outbound relay',
  hideSTARTTLS: true,
  disabledCommands: ['AUTH'],
  authOptional: true,
  size: 26_214_400,
  onConnect(session, callback) {
    if (!clientAllowed(session.remoteAddress)) {
      return callback(new Error('Client not permitted'));
    }
    return callback();
  },
  onMailFrom(address, session, callback) {
    if (address.address.toLowerCase() !== senderAddress) {
      return callback(new Error('Sender not permitted'));
    }
    return callback();
  },
  onData(stream, session, callback) {
    const chunks = [];
    let size = 0;
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size <= 26_214_400) chunks.push(chunk);
    });
    stream.on('error', callback);
    stream.on('end', async () => {
      if (size > 26_214_400) return callback(new Error('Message too large'));
      try {
        const response = await sendViaGmail({
          from: session.envelope.mailFrom.address,
          to: session.envelope.rcptTo.map(({ address }) => address),
          raw: Buffer.concat(chunks),
        });
        console.log(JSON.stringify({ event: 'relayed', recipients: session.envelope.rcptTo.length, response }));
        return callback(null, 'Queued by Gmail');
      } catch (error) {
        console.error(JSON.stringify({
          event: 'relay_error',
          message: error.message,
          code: error.code,
          responseCode: error.responseCode,
        }));
        return callback(error);
      }
    });
  },
});

server.on('error', (error) => {
  console.error(JSON.stringify({ event: 'server_error', message: error.message }));
});

server.listen(listenPort, listenHost, () => {
  console.log(JSON.stringify({ event: 'ready', host: listenHost, port: listenPort }));
});
