import net from 'node:net';
const socket = net.connect(2526, '127.0.0.1');
socket.setTimeout(3000);
socket.once('connect', () => { socket.destroy(); process.exit(0); });
socket.once('error', () => process.exit(1));
socket.once('timeout', () => process.exit(1));
