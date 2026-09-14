import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

for (const method of ['apiFetch', 'apiFetchEnvelope']) {
  test(`${method} never retries account A's request after switching to B`, async () => {
    const source = fs.readFileSync(new URL('../app/_api/client.ts', import.meta.url), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    let session = 'session-A'; let access = 'access-A'; const requests = []; let release;
    class ApiError extends Error {constructor(message,status,code){super(message);this.status=status;this.code=code;}}
    const modules = {
      './tokens': {getAccessToken:()=>access,getRefreshToken:()=>session,clearTokens:()=>{},setTokens:()=>{throw new Error('must not refresh another account')}},
      './types': {ApiError},
      '../_diagnostics/reportDiagnostics': {recordNetworkStart:()=>0,recordNetworkEnd:()=>{}},
    };
    const exports={};
    vm.runInNewContext(compiled, {exports,require:name=>modules[name],process:{env:{}},FormData,JSON,fetch:async(url,options)=>{requests.push(options.headers.Authorization);return await new Promise(resolve=>{release=()=>resolve({ok:false,status:401,json:async()=>({error:{message:'expired',code:'invalid_token'}}),headers:new Headers()});});}});
    const pending=exports[method]('/me/profile',{method:'PATCH',body:{grade:'senior'}});
    session='session-B';access='access-B';release();
    const error = await pending.catch(error=>error);
    expect(error.code).toBe('session_changed');
    expect(requests).toEqual(['Bearer access-A']);
  });
}

test('registration waits for its browser-bound email challenge', async ({ page }) => {
  await page.goto('/register');
  await page.locator('input[type=email]').fill('security@example.invalid');
  await page.locator('input[type=password]').nth(0).fill('Password123!');
  for (const checkbox of await page.locator('input[type=checkbox]').all()) await checkbox.check();
  await page.locator('button[type=submit]').click();
  await expect(page).toHaveURL(/\/verify-email$/);
  expect(await page.evaluate(()=>localStorage.getItem('realgo:auth:session:v2'))).toBeNull();
  await page.locator('input[inputmode=numeric]').fill('123456');
  await page.locator('button[type=submit]').click();
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('realgo:auth:session:v2'))).toBe('LIVE.session');
  expect(await page.evaluate(()=>[localStorage.getItem('realgo:auth:access:v1'),localStorage.getItem('realgo:auth:refresh:v1')])).toEqual([null,null]);
  const cookies=await page.context().cookies();
  expect(cookies.find(cookie=>cookie.name==='realgo-refresh-LIVE.session')?.httpOnly).toBe(true);
  expect(await page.evaluate(()=>document.cookie)).not.toContain('LIVE.refresh');
});

test('reset credentials leave the address bar and auth pages reject injected scripts', async ({ page }) => {
  await page.route('**/reset-password',async route=>{const original=await route.fetch();const body=(await original.text()).replace('</head>', '<script>window.__injected = true</script></head>');await route.fulfill({response:original,body});});
  const response=await page.goto('/reset-password#token=not-a-real-reset-token');
  await expect(page).toHaveURL(/\/reset-password$/);
  const policy=response.headers()['content-security-policy'];
  expect(policy).toContain("'nonce-");
  expect(policy).not.toContain("'unsafe-eval'");
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  expect(response.headers()['cache-control']).toContain('no-store');
  expect(await page.evaluate(()=>window.__injected)).toBeUndefined();
  expect(await page.evaluate(async()=>{const keys=[];for(const name of await caches.keys()){for(const request of await(await caches.open(name)).keys())keys.push(request.url)}return keys;})).not.toContain(expect.stringContaining('token='));
});
