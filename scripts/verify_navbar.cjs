const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EVIDENCE_DIR = path.resolve(__dirname, '../docs/qa/evidence/screenshots');
const ARTIFACT_DIR = 'C:\\Users\\venka\\.gemini\\antigravity\\brain\\aaf6b858-cf69-4fca-a532-34419d634151';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  console.log('Navigating to http://localhost:3333 ...');
  await page.goto('http://localhost:3333', { waitUntil: 'networkidle0' });

  // 1. Dark Theme Desktop Navbar
  console.log('Capturing Dark Theme Navbar...');
  const darkNavPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_dark.png');
  await page.screenshot({ path: darkNavPath, clip: { x: 0, y: 0, width: 1440, height: 350 } });

  // 2. Hover over "Features"
  console.log('Hovering over Features...');
  const featuresLink = await page.$('a[href="#features"]');
  if (featuresLink) {
    await featuresLink.hover();
    await new Promise(r => setTimeout(r, 400));
  }
  const hoverNavPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_hover.png');
  await page.screenshot({ path: hoverNavPath, clip: { x: 0, y: 0, width: 1440, height: 350 } });

  // 3. Click "About" to test active pill transition
  console.log('Clicking About...');
  const aboutLink = await page.$('a[href="#about"]');
  if (aboutLink) {
    await aboutLink.click();
    await new Promise(r => setTimeout(r, 600));
  }
  const activeAboutPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_active_about.png');
  await page.screenshot({ path: activeAboutPath, clip: { x: 0, y: 0, width: 1440, height: 350 } });

  // 4. Toggle to Light Theme
  console.log('Toggling to Light Theme...');
  const themeToggleBtn = await page.$('button[title*="Light"]');
  if (themeToggleBtn) {
    await themeToggleBtn.click();
    await new Promise(r => setTimeout(r, 500));
  }
  const lightNavPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_light.png');
  await page.screenshot({ path: lightNavPath, clip: { x: 0, y: 0, width: 1440, height: 350 } });

  // 5. Mobile Viewport
  console.log('Testing Mobile Viewport...');
  await page.setViewport({ width: 390, height: 844 });
  await new Promise(r => setTimeout(r, 300));
  const mobileNavPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_mobile.png');
  await page.screenshot({ path: mobileNavPath, clip: { x: 0, y: 0, width: 390, height: 300 } });

  // 6. Mobile Open Menu
  console.log('Opening mobile menu...');
  const menuBtn = await page.$('button[aria-label="Toggle navigation menu"]');
  if (menuBtn) {
    await menuBtn.click();
    await new Promise(r => setTimeout(r, 400));
  }
  const mobileMenuPath = path.join(EVIDENCE_DIR, 'navbar_floating_pill_mobile_menu.png');
  await page.screenshot({ path: mobileMenuPath, clip: { x: 0, y: 0, width: 390, height: 500 } });

  await browser.close();
  console.log('Screenshots saved successfully!');

  // Copy to artifact directory
  [
    'navbar_floating_pill_dark.png',
    'navbar_floating_pill_hover.png',
    'navbar_floating_pill_active_about.png',
    'navbar_floating_pill_light.png',
    'navbar_floating_pill_mobile.png',
    'navbar_floating_pill_mobile_menu.png'
  ].forEach(file => {
    const src = path.join(EVIDENCE_DIR, file);
    const dest = path.join(ARTIFACT_DIR, file);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
      console.log(`Copied ${file} to artifacts directory.`);
    }
  });
}

run().catch(err => {
  console.error('Error running puppeteer verification:', err);
  process.exit(1);
});

