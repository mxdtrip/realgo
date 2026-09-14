import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import { createRelay, validSenderHeaders } from './server.mjs';
const message = (headers = '', body = 'Hello') => Buffer.from(`From: ReAlgo <noreply@realgo.dev>\r\nReply-To: support@realgo.dev\r\nTo: receiver@example.invalid\r\n${headers}\r\n${body}`);

test('sender header boundary rejects duplicates and forged identity', () => {
  assert.equal(validSenderHeaders(message()), true);
  assert.equal(validSenderHeaders(message('From: attacker@example.invalid\r\n')), false);
  assert.equal(validSenderHeaders(message('Reply-To: attacker@example.invalid\r\n')), false);
});

test('submission restricts peer, sender, recipients and actual DATA bytes', async () => {
  let sent = 0;
  const relay = createRelay({permittedHost:'api',resolvePeers:async()=>[{address:'127.0.0.1'}],transporter:{sendMail:async()=>{sent++;}},maxSize:1024});
  await new Promise(resolve=>relay.listen(0,'127.0.0.1',resolve));
  const transport = nodemailer.createTransport({host:'127.0.0.1',port:relay.server.address().port,secure:false,ignoreTLS:true});
  const send = (raw,from='noreply@realgo.dev',to=['receiver@example.invalid']) => transport.sendMail({envelope:{from,to},raw});
  try {
    await send(message()); assert.equal(sent,1);
    await assert.rejects(send(message(),'attacker@example.invalid'));
    const partial = await send(message(),undefined,['a@example.invalid','b@example.invalid']);
    assert.equal(partial.accepted.length,1); assert.equal(partial.rejected.length,1);
    await assert.rejects(send(message('From: attacker@example.invalid\r\n')));
    await assert.rejects(send(message('', 'x'.repeat(4096))), e=>e.responseCode===552);
    assert.equal(sent,2);
  } finally { transport.close(); await new Promise(resolve=>relay.close(resolve)); }
  const denied = createRelay({permittedHost:'api',resolvePeers:async()=>[{address:'192.0.2.1'}],transporter:{sendMail:async()=>{throw new Error('must not send')}}});
  await new Promise(resolve=>denied.listen(0,'127.0.0.1',resolve));
  const client=nodemailer.createTransport({host:'127.0.0.1',port:denied.server.address().port,secure:false,ignoreTLS:true});
  try {await assert.rejects(client.sendMail({envelope:{from:'noreply@realgo.dev',to:'a@example.invalid'},raw:message()}));}
  finally {client.close();await new Promise(resolve=>denied.close(resolve));}
});
