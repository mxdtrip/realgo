import { fileURLToPath } from 'node:url';
import { lookup } from 'node:dns/promises';
import { SMTPServer } from 'smtp-server';
import nodemailer from 'nodemailer';

const MAX_MESSAGE_SIZE = 26_214_400;
const sender = 'noreply@realgo.dev';
const permittedHost = process.env.RELAY_CLIENT_HOST;
const username = process.env.RELAY_SMTP_USERNAME;
const password = process.env.RELAY_SMTP_PASSWORD;
function upstreamTransport() { return nodemailer.createTransport({
  host: process.env.RELAY_SMTP_HOST || 'mail.smtp2go.com',
  port: Number(process.env.RELAY_SMTP_PORT || 2525),
  secure: false, requireTLS: true,
  tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
  auth: { user: username, pass: password },
  connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  pool: true, maxConnections: 2, maxMessages: 50,
  logger: false, debug: false,
}); }
const failure = (message, responseCode) => Object.assign(new Error(message), { responseCode });

export function validSenderHeaders(raw) {
  const boundary = raw.indexOf('\r\n\r\n');
  if (boundary < 0 || boundary > 65536) return false;
  const headers = raw.subarray(0, boundary).toString('utf8').replace(/\r\n[ \t]+/g, ' ');
  const from = [...headers.matchAll(/^From:\s*(.+)$/gmi)];
  const reply = [...headers.matchAll(/^Reply-To:\s*(.+)$/gmi)];
  return from.length === 1 && /^(?:ReAlgo|"ReAlgo") <noreply@realgo\.dev>\s*$/i.test(from[0][1]) &&
    reply.length === 1 && /^support@realgo\.dev\s*$/i.test(reply[0][1]);
}
export function createRelay({ transporter, permittedHost, resolvePeers = lookup, maxSize = MAX_MESSAGE_SIZE }) {
const connections = new Set();
const server = new SMTPServer({
  hideSTARTTLS: true, disabledCommands: ['AUTH'], authOptional: true,
  size: maxSize, maxClients: 4, socketTimeout: 30000,
  async onConnect(session, callback) {
    try {
      const address = (session.remoteAddress || '').replace(/^::ffff:/, '');
      const peers = await resolvePeers(permittedHost, { all: true });
      if (!peers.some((peer) => peer.address === address) || connections.size >= 4) return callback(failure('Client not permitted', 554));
      connections.add(session.id); callback();
    } catch { callback(failure('Submission unavailable', 451)); }
  },
  onClose(session) { connections.delete(session.id); },
  onMailFrom(address, _session, callback) { callback(address.address.toLowerCase() === sender ? undefined : failure('Sender not permitted', 553)); },
  onRcptTo(_address, session, callback) { callback(session.envelope.rcptTo.length < 1 ? undefined : failure('One recipient per message', 452)); },
  onData(stream, session, callback) {
    const chunks = []; let size = 0; let completed = false;
    const finish = (error, message) => { if (!completed) { completed = true; callback(error, message); } };
    stream.on('data', (chunk) => { size += chunk.length; if (size <= maxSize) chunks.push(chunk); else chunks.length = 0; });
    stream.on('error', () => finish(failure('Message stream failed', 451)));
    stream.on('end', async () => {
      if (completed) return;
      if (stream.sizeExceeded || size > maxSize) return finish(failure('Message too large', 552));
      const raw = Buffer.concat(chunks);
      if (!validSenderHeaders(raw)) return finish(failure('Sender headers not permitted', 553));
      try {
        await transporter.sendMail({ envelope: { from: sender, to: session.envelope.rcptTo.map(({ address }) => address) }, raw });
        console.log(JSON.stringify({ event: 'relay_provider_accepted' }));
        finish(null, 'Accepted by provider');
      } catch (error) {
        const permanent = Number(error.responseCode) >= 500;
        console.error(JSON.stringify({ event: 'relay_provider_failed', category: permanent ? 'permanent' : 'temporary' }));
        finish(failure('Provider delivery failed', permanent ? 554 : 451));
      }
    });
  },
});
server.on('error', () => { console.error(JSON.stringify({ event: 'relay_server_failed' })); });
return server;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (!username || !password || !permittedHost) throw new Error('Relay credentials and RELAY_CLIENT_HOST are required');
  createRelay({ transporter: upstreamTransport(), permittedHost }).listen(2526, '0.0.0.0');
}
