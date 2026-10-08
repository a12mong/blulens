import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Member clip upload (bl-36-2/3/4), API level against MinIO: upload-url -> PUT sample.mp4 with the declared Content-Type
 * -> complete { durationSec } -> the assessment shows the clip uploaded with a fetchable viewUrl -> submit accepts it.
 * Needs MinIO running (docker compose up -d minio). No SQL. See docs/qa/slice1-e2e.md (prerequisites).
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const SAMPLE = readFileSync(join(__dirname, '..', 'public', 'e2e', 'sample.mp4'));

async function data<T = any>(res: APIResponse): Promise<T> {
  const json = await res.json();
  return (json && typeof json === 'object' && 'data' in json ? json.data : json) as T;
}
async function errCode(res: APIResponse): Promise<string> {
  const j = await res.json();
  return (j?.error ?? j)?.code;
}
async function login(ctx: APIRequestContext, identifier: string, password: string) {
  const res = await ctx.post('auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
}

test.describe.serial('clip upload (API + MinIO)', () => {
  let member: APIRequestContext;
  let other: APIRequestContext;
  let reviewer: APIRequestContext;
  let assessmentId = '';
  let clipId = '';
  let firstClip: { clipId: string; uploadUrl: string } = { clipId: '', uploadUrl: '' };
  let thirdClipId = '';

  const urlReq = (ctx: APIRequestContext, id: string, body: Record<string, unknown> = {}) =>
    ctx.post(`assessments/${id}/clips/upload-url`, {
      data: { fileName: 'sample.mp4', contentType: 'video/mp4', sizeBytes: SAMPLE.length, ...body },
    });

  test.beforeAll(async ({ playwright }) => {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
    const mk = () => playwright.request.newContext({ baseURL: API_BASE });
    [member, other, reviewer] = [await mk(), await mk(), await mk()];
    await login(member, 'member1@blulens.local', pw);
    await login(other, 'member2@blulens.local', pw);
    await login(reviewer, 'reviewer1@blulens.local', pw);
    const c = await member.post('assessments', { data: { note: `e2e clip upload ${Date.now()}` } });
    expect(c.status(), await c.text()).toBe(201);
    assessmentId = (await data(c)).id;
  });

  test('C1 upload-url returns a clipId and a signed uploadUrl; non-members and other members are refused', async () => {
    expect((await urlReq(reviewer, assessmentId)).status(), 'Reviewer role').toBe(403);
    const foreign = await urlReq(other, assessmentId);
    expect([403, 404], 'another member').toContain(foreign.status());
    const res = await urlReq(member, assessmentId);
    expect(res.status(), await res.text()).toBe(200);
    const d = await data(res);
    firstClip = d;
    expect(d.clipId).toBeTruthy();
    expect(d.uploadUrl).toMatch(/^https?:\/\//);
  });

  test('C2 PUT with a different Content-Type than declared -> 403 (signed URL); complete before any PUT -> 409 CLIP_NOT_UPLOADED', async () => {
    const d = firstClip;
    const bad = await fetch(d.uploadUrl, { method: 'PUT', body: SAMPLE, headers: { 'Content-Type': 'application/octet-stream' } });
    expect(bad.status).toBe(403);
    const early = await member.post(`clips/${d.clipId}/complete`, { data: { durationSec: 4 } });
    expect(early.status()).toBe(409);
    expect(await errCode(early)).toBe('CLIP_NOT_UPLOADED');
  });

  test('C3 PUT sample.mp4 with video/mp4, complete { durationSec: 4 } -> uploaded with a viewUrl that serves the same bytes', async () => {
    // a fresh upload (C1 clip was never PUT)
    const d = await data(await urlReq(member, assessmentId));
    clipId = d.clipId;
    const put = await fetch(d.uploadUrl, { method: 'PUT', body: SAMPLE, headers: { 'Content-Type': 'video/mp4' } });
    expect(put.status).toBe(200);
    const done = await member.post(`clips/${clipId}/complete`, { data: { durationSec: 4 } });
    expect(done.status(), await done.text()).toBe(200);
    const c = await data(done);
    expect(c).toMatchObject({ id: clipId, status: 'uploaded', durationSec: 4 });
    const dl = await fetch(c.viewUrl);
    expect(dl.status).toBe(200);
    expect(Buffer.from(await dl.arrayBuffer()).equals(SAMPLE), 'downloaded bytes equal sample.mp4').toBe(true);
    const again = await member.post(`clips/${clipId}/complete`, { data: { durationSec: 99 } });
    expect(again.status(), 'idempotent').toBe(200);
    expect((await data(again)).durationSec).toBe(4);
  });

  test('C4 GET /assessments/{id} lists the clip as uploaded with a fetchable viewUrl', async () => {
    const res = await member.get(`assessments/${assessmentId}`);
    expect(res.status(), await res.text()).toBe(200);
    const a = await data(res);
    const clip = (a.clips ?? []).find((c: any) => c.id === clipId);
    expect(clip, 'clip on the assessment').toBeTruthy();
    expect(clip.status).toBe('uploaded');
    expect(clip.viewUrl).toBeTruthy();
    expect((await fetch(clip.viewUrl)).status).toBe(200);
  });

  test('C5 complete guards: other member -> 404 CLIP_NOT_FOUND, Reviewer -> 403, durationSec 0 -> 400, 301 -> 422 CLIP_TOO_LONG', async () => {
    const o = await other.post(`clips/${clipId}/complete`, { data: { durationSec: 4 } });
    expect(o.status()).toBe(404);
    expect(await errCode(o)).toBe('CLIP_NOT_FOUND');
    expect((await reviewer.post(`clips/${clipId}/complete`, { data: { durationSec: 4 } })).status()).toBe(403);
    const fresh = await data(await urlReq(member, assessmentId));
    thirdClipId = fresh.clipId;
    const zero = await member.post(`clips/${fresh.clipId}/complete`, { data: { durationSec: 0 } });
    expect(zero.status()).toBe(400);
    expect(await errCode(zero)).toBe('VALIDATION_FAILED');
    const long = await member.post(`clips/${fresh.clipId}/complete`, { data: { durationSec: 301 } });
    expect(long.status(), await long.text()).toBe(422);
    expect(await errCode(long)).toBe('CLIP_TOO_LONG');
  });

  test('C5b a 4th clip on the same assessment -> 409 CLIP_LIMIT_REACHED (max 3)', async () => {
    expect(thirdClipId).toBeTruthy();
    const res = await urlReq(member, assessmentId);
    expect(res.status(), await res.text()).toBe(409);
    expect(await errCode(res)).toBe('CLIP_LIMIT_REACHED');
  });

  test('C6 submit accepts the assessment with a really uploaded clip (200)', async () => {
    const sub = await member.post(`assessments/${assessmentId}/submit`);
    expect(sub.status(), await sub.text()).toBe(200);
  });
});
