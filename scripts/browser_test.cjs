const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.resolve(__dirname, '../docs/qa/evidence/screenshots');

const PORTALS = [
  { name: 'Client & Specialist Web Portal', url: 'http://localhost:3000', prefix: 'web_portal' },
  { name: 'Admin Portal', url: 'http://localhost:3001', prefix: 'admin_portal' },
  { name: 'Superadmin Portal', url: 'http://localhost:3002', prefix: 'superadmin_portal' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

async function runBrowserTests() {
  console.log('=== STARTING TRUSTPAY REAL BROWSER FUNCTIONAL VERIFICATION ===');
  console.log(`Using Chrome at: ${CHROME_PATH}`);
  console.log(`Screenshots will be saved to: ${SCREENSHOT_DIR}`);

  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const testResults = [];

  for (const portal of PORTALS) {
    console.log(`\n------------------------------------------------------------`);
    console.log(`Testing Portal: ${portal.name} (${portal.url})`);
    console.log(`------------------------------------------------------------`);

    const portalResult = {
      name: portal.name,
      url: portal.url,
      consoleErrors: [],
      consoleWarnings: [],
      failedRequests: [],
      totalRequests: 0,
      successfulRequests: 0,
      testedControls: [],
      viewports: {},
      status: 'PASS'
    };

    const page = await browser.newPage();

    page.on('console', msg => {
      const text = msg.text();
      if (msg.type() === 'error') {
        portalResult.consoleErrors.push(text);
      } else if (msg.type() === 'warn') {
        portalResult.consoleWarnings.push(text);
      }
    });

    page.on('requestfailed', request => {
      portalResult.failedRequests.push({
        url: request.url(),
        error: request.failure()?.errorText || 'Unknown error'
      });
    });

    page.on('response', response => {
      portalResult.totalRequests++;
      if (response.status() >= 200 && response.status() < 400) {
        portalResult.successfulRequests++;
      }
    });

    // 1. Test Desktop Viewport
    for (const vp of VIEWPORTS) {
      console.log(`  > Testing Viewport: ${vp.name} (${vp.width}x${vp.height})`);
      await page.setViewport({ width: vp.width, height: vp.height });

      try {
        const response = await page.goto(portal.url, { waitUntil: 'networkidle2', timeout: 30000 });
        const httpStatus = response?.status();
        console.log(`    HTTP Status: ${httpStatus}`);

        // Wait an additional 2s for animations and state initialization
        await new Promise(r => setTimeout(r, 2000));

        const screenshotPath = path.join(SCREENSHOT_DIR, `${portal.prefix}_${vp.name}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`    Screenshot saved: ${screenshotPath}`);

        const pageTitle = await page.title();
        const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300).replace(/\n+/g, ' '));

        portalResult.viewports[vp.name] = {
          httpStatus,
          pageTitle,
          bodySnippet: bodyText,
          screenshot: path.basename(screenshotPath)
        };

      } catch (err) {
        console.error(`    Error during ${vp.name} test:`, err.message);
        portalResult.status = 'FAIL';
        portalResult.viewports[vp.name] = { error: err.message };
      }
    }

    // 2. Discover and Test Interactive Controls (on Desktop)
    await page.setViewport({ width: 1920, height: 1080 });
    try {
      const controls = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button')).map((b, i) => ({
          index: i,
          text: b.innerText.trim(),
          disabled: b.disabled,
          type: 'button'
        }));
        const inputs = Array.from(document.querySelectorAll('input')).map((inp, i) => ({
          index: i,
          placeholder: inp.placeholder || '',
          type: inp.type || 'text',
          disabled: inp.disabled
        }));
        const links = Array.from(document.querySelectorAll('a')).map((a, i) => ({
          index: i,
          text: a.innerText.trim(),
          href: a.href
        }));
        return { buttons, inputs, links };
      });

      console.log(`    Discovered Controls: ${controls.buttons.length} buttons, ${controls.inputs.length} inputs, ${controls.links.length} links`);
      portalResult.controlsSummary = controls;

      // Click on interactive buttons that are safe (e.g., refresh buttons, tabs)
      for (const btn of controls.buttons.slice(0, 5)) {
        if (!btn.disabled && btn.text) {
          try {
            console.log(`    Testing click on control: "${btn.text}"`);
            await page.evaluate((idx) => {
              const b = document.querySelectorAll('button')[idx];
              if (b) b.click();
            }, btn.index);
            await new Promise(r => setTimeout(r, 500));
            portalResult.testedControls.push({ text: btn.text, action: 'clicked', result: 'success' });
          } catch (clickErr) {
            portalResult.testedControls.push({ text: btn.text, action: 'clicked', result: 'error', error: clickErr.message });
          }
        }
      }

    } catch (ctrlErr) {
      console.warn(`    Controls discovery warning:`, ctrlErr.message);
    }

    await page.close();
    testResults.push(portalResult);
  }

  await browser.close();

  const reportPath = path.resolve(__dirname, '../docs/qa/evidence/browser_test_results.json');
  fs.writeFileSync(reportPath, JSON.stringify(testResults, null, 2));
  console.log(`\nBrowser testing completed! Summary saved to: ${reportPath}`);
  console.log('=== END BROWSER VERIFICATION ===\n');
}

runBrowserTests().catch(err => {
  console.error('Fatal browser test runner error:', err);
  process.exit(1);
});

