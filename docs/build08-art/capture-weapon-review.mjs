import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const root = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH,
  args: ['--use-angle=d3d11', '--enable-gpu'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  for (const kind of ['ossuary', 'breach', 'arc', 'reliquary']) {
    await page.goto(`http://127.0.0.1:5200/docs/build08-art/weapon-review.html?weapon=${kind}`, { waitUntil: 'networkidle' });
    await page.locator(`[data-kind="${kind}"]`).click();
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(root, 'docs', 'build08-art', `weapon-${kind}.png`) });
    await page.locator('#pulse').click();
    await page.waitForTimeout(140);
    await page.screenshot({ path: path.join(root, 'docs', 'build08-art', `weapon-${kind}-shot.png`) });
  }
  console.log(JSON.stringify({ errors }));
} finally {
  await browser.close();
}
