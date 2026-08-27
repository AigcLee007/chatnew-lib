import { test, expect } from '@playwright/test';

const portalUrl = process.env.PORTAL_URL || 'http://127.0.0.1:4173';

test.describe('ChatVIP version portal', () => {
  test('shows the new experience as the recommended option', async ({ page }) => {
    await page.goto(portalUrl);
    await expect(page.locator('h1')).toHaveText('选择你的 AI 工作空间');
    await expect(page.locator('[data-version="new"] .badge--recommended')).toContainText('推荐使用');
    await expect(page.locator('[data-version="new"]')).toContainText('跨设备保留');
  });

  test('uses the exact destinations for both version links', async ({ page }) => {
    await page.goto(portalUrl);
    await expect(page.locator('[data-version="new"] .card-cta')).toHaveAttribute(
      'href',
      'https://chat.aittco.com',
    );
    await expect(page.locator('[data-version="classic"] .card-cta')).toHaveAttribute(
      'href',
      'https://chatvvip.aittco.com',
    );
  });

  test('keeps the new card first on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(portalUrl);
    await expect(page.locator('.version-card').first()).toHaveAttribute('data-version', 'new');
  });

  test('keeps both choices visible in a standard desktop first viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 760 });
    await page.goto(portalUrl);
    for (const selector of ['[data-version="new"] .card-cta', '[data-version="classic"] .card-cta']) {
      const bottom = await page.locator(selector).evaluate((element) => element.getBoundingClientRect().bottom);
      expect(bottom).toBeLessThanOrEqual(760);
    }
  });
});
