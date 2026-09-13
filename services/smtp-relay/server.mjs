import net from 'node:net';
import tls from 'node:tls';
import { SMTPServer } from 'smtp-server';

const host = process.env.RELAY_SMTP_HOST || 'mail.smtp2go.com';
const port = Number(process.env.RELAY_SMTP_PORT || 2525);
const username = process.env.RELAY_SMTP_USERNAME;
const password = process.env.RELAY_SMTP_PASSWORD;
const sender = (process.env.SENDER_ADDRESS || 'noreply@realgo.dev').toLowerCase();
if (!username || !password) throw new Error('RELAY_SMTP_USERNAME and RELAY_SMTP_PASSWORD are required');

function readResponses(socket) {
  let buffer = ''; const waiters = [];
  const consume = () => {
    const lines = buffer.split('\r\n');
    for (let i = 0; i < lines.length - 1; i += 1) if (/^\d{3} /.test(lines[i])) { const out = lines.slice(0, i + 1).join('\r\n'); buffer = lines.slice(i + 1).join('\r\n'); waiters.shift()?.resolve(out); consume(); return; }
  };
  socket.on('data', (chunk) => { buffer += chunk.toString('utf8'); consume(); });
  socket.on('error', (error) => waiters.shift()?.reject(error));
  return () => new Promise((resolve, reject) => { waiters.push({ resolve, reject }); consume(); });
}
function expect(value, wanted, stage) { if (!value.startsWith(wanted)) throw new Error(`${stage} failed (${value.slice(0, 3) || 'network'})`); }
function dotStuff(raw) { let text = raw.toString('latin1').replace(/\r?\n/g, '\r\n').replace(/(^|\r\n)\./g, '$1..'); if (!text.endsWith('\r\n')) text += '\r\n'; return Buffer.from(`${text}.\r\n`, 'latin1'); }

async function upstream({ from, recipients, raw }) {
  let socket = net.connect(port, host); socket.setTimeout(30000, () => socket.destroy(new Error('smtp timeout')));
  let read = readResponses(socket);
  try {
    expect(await read(), '220', 'greeting'); socket.write('EHLO realgo.dev\r\n'); expect(await read(), '250', 'ehlo');
    socket.write('STARTTLS\r\n'); expect(await read(), '220', 'starttls');
    socket.removeAllListeners('data'); socket.removeAllListeners('error');
    socket = tls.connect({ socket, servername: host, minVersion: 'TLSv1.2', rejectUnauthorized: true });
    await new Promise((resolve, reject) => { socket.once('secureConnect', resolve); socket.once('error', reject); }); read = readResponses(socket);
    socket.write('EHLO realgo.dev\r\n'); expect(await read(), '250', 'secure ehlo');
    socket.write(`AUTH PLAIN ${Buffer.from(`\0${username}\0${password}`).toString('base64')}\r\n`); expect(await read(), '235', 'auth');
    socket.write(`MAIL FROM:<${from}>\r\n`); expect(await read(), '250', 'mail from');
    for (const recipient of recipients) { socket.write(`RCPT TO:<${recipient}>\r\n`); expect(await read(), '250', 'recipient'); }
    socket.write('DATA\r\n'); expect(await read(), '354', 'data'); socket.write(dotStuff(raw)); expect(await read(), '250', 'message'); socket.end('QUIT\r\n');
  } catch (error) { socket.destroy(); throw error; }
}

const server = new SMTPServer({
  hideSTARTTLS: true, disabledCommands: ['AUTH'], authOptional: true, size: 26_214_400,
	// The relay has no host port. Keep an explicit second boundary anyway: only
	// private Docker-network peers may use the provider credentials.
  onConnect(session, callback) {
    const address = (session.remoteAddress || '').replace(/^::ffff:/, '');
    callback(address === '127.0.0.1' || address === '::1' || address.startsWith('10.') || address.startsWith('172.') || address.startsWith('192.168.') ? undefined : new Error('client not permitted'));
  },
  onMailFrom(address, _session, callback) { callback(address.address.toLowerCase() === sender ? undefined : new Error('sender not permitted')); },
  onData(stream, session, callback) {
    const chunks = []; stream.on('data', (chunk) => chunks.push(chunk)); stream.on('error', callback);
    stream.on('end', async () => { try { await upstream({ from: session.envelope.mailFrom.address, recipients: session.envelope.rcptTo.map(({ address }) => address), raw: Buffer.concat(chunks) }); console.log(JSON.stringify({ event: 'relay_provider_accepted', provider: 'smtp2go', recipients: session.envelope.rcptTo.length })); callback(null, 'Queued by SMTP2GO'); } catch (error) { console.error(JSON.stringify({ event: 'relay_provider_failed', provider: 'smtp2go', message: error.message })); callback(error); } });
  },
});
server.listen(2526, '0.0.0.0', () => console.log(JSON.stringify({ event: 'relay_ready', provider: 'smtp2go', upstream_host: host, upstream_port: port })));
