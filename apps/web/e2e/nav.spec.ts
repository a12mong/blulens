import { test, expect, type Browser, type Page } from '@playwright/test';

/**
 * Navigation smoke (bl-26-p10 shell): per-role menu labels, account block, mobile drawer at 390px, menu skeleton.
 * Logs in through the API inside a fresh browser context (cookies are per host, shared with the web page).
 * umpire1@blulens.local is created by SQL on blulens_e2e when the seed does not have it yet.
 */

const API_BASE = (process.env.API_URL ?? 'http://localhost:3191').replace(/\/+$/, '') + '/api/v1/';
const WEB_BASE = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3190';
const pw = () => {
  const v = process.env.SEED_DEMO_PASSWORD;
  if (!v) throw new Error('SEED_DEMO_PASSWORD must be set (no defaults)');
  return v;
};

const L = {
  member: 'ของฉัน',
  reviewer: 'ตรวจประเมิน',
  umpire: 'บันทึกคะแนน',
  committee: 'ผลประเมิน',
  admin: 'จัดการผู้ใช้',
};

async function asUser(browser: Browser, identifier: string, password: string, viewport = { width: 1280, height: 800 }) {
  const ctx = await browser.newContext({ baseURL: WEB_BASE, viewport });
  const res = await ctx.request.post(API_BASE + 'auth/login', { data: { identifier, password } });
  expect(res.status(), `login ${identifier}`).toBe(200);
  const page = await ctx.newPage();
  return { ctx, page };
}

const nav = (page: Page) => page.getByRole('navigation', { name: 'เมนูหลัก' });

test.describe('nav smoke: menu per role', () => {
  const cases: Array<{ who: string; email: string; password: () => string; has: string[]; hasNot: string[]; roleText: string }> = [
    { who: 'member1', email: 'member1@blulens.local', password: pw, has: [L.member], hasNot: [L.reviewer, L.umpire, L.committee, L.admin], roleText: 'สมาชิก' },
    { who: 'reviewer1', email: 'reviewer1@blulens.local', password: pw, has: [L.reviewer], hasNot: [L.committee, L.admin], roleText: 'ผู้ตรวจประเมิน' },
    { who: 'committee', email: 'committee@blulens.local', password: pw, has: [L.committee], hasNot: [L.admin], roleText: 'คณะกรรมการ' },
    { who: 'admin', email: process.env.SEED_ADMIN_EMAIL ?? 'admin@blulens.local', password: () => process.env.SEED_ADMIN_PASSWORD ?? '', has: [L.admin, L.committee], hasNot: [], roleText: 'ผู้ดูแลระบบ' },
  ];

  for (const c of cases) {
    test(`N1 ${c.who}: sees its menu labels + account block`, async ({ browser }) => {
      const { ctx, page } = await asUser(browser, c.email, c.password());
      await page.goto('/events');
      await expect(nav(page)).toBeVisible({ timeout: 20000 });
      await expect(page.getByTestId('menu-skeleton')).toHaveCount(0, { timeout: 20000 });
      for (const label of c.has) await expect(nav(page).getByRole('link', { name: label, exact: true }), label).toBeVisible();
      for (const label of c.hasNot) await expect(nav(page).getByRole('link', { name: label, exact: true }), `no ${label}`).toHaveCount(0);
      await expect(nav(page).getByRole('link', { name: 'อีเวนต์', exact: true })).toBeVisible();
      await expect(page.getByTestId('account-block')).toBeVisible();
      await expect(page.getByTestId('account-name')).not.toBeEmpty();
      await expect(page.getByTestId('account-role')).toContainText(c.roleText);
      await expect(page.getByTestId('drawer-toggle'), 'desktop has no drawer button').toBeHidden();
      await ctx.close();
    });
  }

  test('N2 umpire sees "บันทึกคะแนน" (account created by SQL if the seed lacks it)', async ({ browser }) => {
    const { execFileSync } = await import('child_process');
    const sql = (q: string) =>
      execFileSync('docker', ['exec', process.env.E2E_PG_CONTAINER ?? 'blulens-postgres', 'psql', '-U', process.env.E2E_PG_USER ?? 'blulens', '-d', 'blulens_e2e', '-tA', '-c', q], { encoding: 'utf8' });
    sql(`insert into users (id,email,password_hash,display_name,status,created_at,updated_at) select gen_random_uuid(),'umpire1@blulens.local',password_hash,'Umpire 1 (e2e)','active',now(),now() from users where email='member1@blulens.local' on conflict (email) do nothing`);
    sql(`insert into user_roles (user_id,role,created_at) select id,'Umpire',now() from users where email='umpire1@blulens.local' on conflict do nothing`);
    const { ctx, page } = await asUser(browser, 'umpire1@blulens.local', pw());
    await page.goto('/events');
    await expect(nav(page).getByRole('link', { name: L.umpire, exact: true })).toBeVisible({ timeout: 20000 });
    await expect(nav(page).getByRole('link', { name: L.admin, exact: true })).toHaveCount(0);
    await expect(page.getByTestId('account-role')).toContainText('กรรมการสนาม');
    await ctx.close();
  });

  test('N3 menu link navigates and the logout button returns to /login', async ({ browser }) => {
    const { ctx, page } = await asUser(browser, 'committee@blulens.local', pw());
    await page.goto('/events');
    await nav(page).getByRole('link', { name: L.committee, exact: true }).click();
    await expect(page).toHaveURL(/\/committee/, { timeout: 20000 });
    // dispatchEvent: the Next dev indicator (nextjs-portal) sits over the bottom-left logout button in dev mode only
    await page.getByTestId('logout-button').dispatchEvent('click');
    await expect(page).toHaveURL(/\/login/, { timeout: 20000 });
    await ctx.close();
  });
});

test.describe('nav smoke: mobile drawer + skeleton', () => {
  test('N4 at 390px the menu is a drawer: hidden, opens, link works, closes on toggle', async ({ browser }) => {
    const { ctx, page } = await asUser(browser, 'committee@blulens.local', pw(), { width: 390, height: 844 });
    await page.goto('/events');
    const toggle = page.getByTestId('drawer-toggle');
    await expect(toggle).toBeVisible({ timeout: 20000 });
    await expect(nav(page), 'closed drawer hides the menu').toBeHidden();
    expect((await toggle.boundingBox())!.height, 'touch target >= 44px').toBeGreaterThanOrEqual(44);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(nav(page)).toBeVisible();
    await expect(page.getByTestId('account-block')).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav(page)).toBeHidden();
    await toggle.click();
    await nav(page).getByRole('link', { name: L.committee, exact: true }).click();
    await expect(page).toHaveURL(/\/committee/, { timeout: 20000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal scroll at 390px').toBe(true);
    await ctx.close();
  });

  test('N5 menu skeleton shows while /auth/me is slow, then the real menu', async ({ browser }) => {
    const { ctx, page } = await asUser(browser, 'member1@blulens.local', pw());
    await page.route('**/auth/me', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.goto('/events');
    await expect(page.getByTestId('menu-skeleton')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('account-block')).toHaveCount(0);
    await expect(page.getByTestId('menu-skeleton')).toHaveCount(0, { timeout: 20000 });
    await expect(nav(page).getByRole('link', { name: L.member, exact: true })).toBeVisible();
    await ctx.close();
  });
});
