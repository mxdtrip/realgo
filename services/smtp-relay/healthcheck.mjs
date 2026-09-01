import net from 'node:net';

const host = process.env.SMTP_LISTEN_HOST === '127.0.0.1' ? '127.0.0.1' : 'localhost';
const port = Number.parseInt(process.env.SMTP_LISTEN_PORT || '2526', 10);

const socket = net.connect({ host, port });
socket.setTimeout(3000, () => socket.destroy(new Error('timeout')));
socket.once('connect', () => {
  socket.end();
  process.exit(0);
});
socket.once('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
