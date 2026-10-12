import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

interface Violation {
  page: string;
  selector: string;
  tag: string;
  text: string;
  property: string;
  value: string;
  rgb: string;
}

function parseRgb(colorStr: string): { r: number; g: number; b: number; a: number }[] {
  const results: { r: number; g: number; b: number; a: number }[] = [];
  const regex = /rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)/gi;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(colorStr)) !== null) {
    const r = Math.round(parseFloat(m[1]));
    const g = Math.round(parseFloat(m[2]));
    const b = Math.round(parseFloat(m[3]));
    const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
    results.push({ r, g, b, a });
  }
  return results;
}

async function getBrowser() {
  try {
    return await chromium.launch({ headless: true });
  } catch {
    return await chromium.launch({ headless: true, channel: 'chrome' });
  }
}

async function runMonoCheck() {
  const screenshotDir = path.resolve(process.cwd(), 'docs/screenshots-mono');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
  }

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();
  const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
  const allViolations: Violation[] = [];

  // Helper to extract non-monochrome styles from current page
  async function auditCurrentView(viewName: string, screenshotName: string) {
    await page.waitForTimeout(1500); // Allow animations, splash screens & data to settle

    // Take screenshot
    const screenshotPath = path.join(screenshotDir, `${screenshotName}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    // Inspect all elements using raw string to prevent esbuild helper injection
    const violations = (await page.evaluate(`
      (() => {
        const results = [];
        const elements = Array.from(document.querySelectorAll('*'));
        const propsToCheck = [
          'color',
          'backgroundColor',
          'borderTopColor',
          'borderRightColor',
          'borderBottomColor',
          'borderLeftColor',
          'outlineColor',
          'fill',
          'stroke',
          'boxShadow',
        ];

        const regex = /rgba?\\(\\s*([0-9.]+)\\s*,\\s*([0-9.]+)\\s*,\\s*([0-9.]+)(?:\\s*,\\s*([0-9.]+))?\\s*\\)/gi;

        for (const el of elements) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 && rect.height === 0) continue;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;

          let sel = el.id ? '#' + el.id : el.tagName.toLowerCase();
          if (!el.id && el.className && typeof el.className === 'string') {
            const first = el.className.trim().split(/\\s+/)[0];
            if (first && !first.includes(':') && !first.includes('[')) sel += '.' + first;
          }

          for (const prop of propsToCheck) {
            const val = style[prop];
            if (!val) continue;

            regex.lastIndex = 0;
            let m;
            while ((m = regex.exec(val)) !== null) {
              const r = Math.round(parseFloat(m[1]));
              const g = Math.round(parseFloat(m[2]));
              const b = Math.round(parseFloat(m[3]));
              const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
              if (a > 0.01) {
                if (r !== g || g !== b) {
                  results.push({
                    page: ${JSON.stringify(viewName)},
                    selector: sel,
                    tag: el.tagName.toLowerCase(),
                    text: (el.textContent || '').trim().slice(0, 35),
                    property: prop,
                    value: val,
                    rgb: 'rgb(' + r + ', ' + g + ', ' + b + ') [alpha=' + a + ']',
                  });
                  break;
                }
              }
            }
          }
        }
        return results;
      })()
    `)) as Violation[];

    allViolations.push(...violations);
  }

  try {
    console.log(`Starting Monochrome Audit on ${baseUrl}...`);

    // Import signSession to guarantee session without rate-limiting issues
    const { signSession } = await import('../lib/auth');
    const sessionToken = await signSession({
      id: 1,
      name: 'karri',
      email: 'karri@teader.io',
      avatar: '/profiles/profile-1.webp',
    });

    await context.addCookies([
      {
        name: 'teader_session',
        value: sessionToken,
        url: baseUrl,
      },
    ]);

    await page.addInitScript((userData) => {
      try {
        localStorage.setItem('teader_user', JSON.stringify(userData));
        localStorage.setItem('teader_token', userData.token);
      } catch {}
    }, {
      id: 1,
      name: 'karri',
      email: 'karri@teader.io',
      avatar: '/profiles/profile-1.webp',
      token: sessionToken,
    });

    console.log('Session injected. Navigating to workspace...');

    // 2. Dashboard
    console.log('Auditing /dashboard...');
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    console.log(`Current page: ${page.url()}`);
    await auditCurrentView('/dashboard', '01-dashboard');

    // 3. Projects list
    console.log('Auditing /projects...');
    await page.goto(`${baseUrl}/projects`, { waitUntil: 'domcontentloaded' });
    await auditCurrentView('/projects', '02-projects');

    // 4. Project Overview
    console.log('Auditing /projects/1 (Overview)...');
    await page.goto(`${baseUrl}/projects/1`, { waitUntil: 'domcontentloaded' });
    await auditCurrentView('/projects/1 (Overview)', '03-project-overview');

    // 5. Project Tasks (Board / List)
    console.log('Auditing /projects/1/tasks...');
    await page.goto(`${baseUrl}/projects/1/tasks`, { waitUntil: 'domcontentloaded' });
    await auditCurrentView('/projects/1/tasks (Board)', '04-project-tasks');

    // 6. Project Docs
    console.log('Auditing /projects/1/docs...');
    await page.goto(`${baseUrl}/projects/1/docs`, { waitUntil: 'domcontentloaded' });
    await auditCurrentView('/projects/1/docs', '05-project-docs');

    // 6b. Docs Editor
    console.log('Auditing Docs editor...');
    const newDocBtn = await page.$('button:has-text("New Doc"), button:has-text("New Tab")');
    if (newDocBtn) {
      await newDocBtn.click();
      await page.waitForTimeout(500);
      const titleInput = await page.$('input[placeholder*="title"], input[placeholder*="filename"]');
      if (titleInput) {
        await titleInput.fill('Architecture Overview');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(1000);
      }
    }
    await auditCurrentView('Docs Editor', '05b-docs-editor');

    // 7. Project Settings
    console.log('Auditing /projects/1/settings...');
    await page.goto(`${baseUrl}/projects/1/settings`, { waitUntil: 'domcontentloaded' });
    await auditCurrentView('/projects/1/settings', '06-project-settings');

    // 8. Command Palette (Cmd+K)
    console.log('Auditing Command Palette...');
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(500);
    await auditCurrentView('Command Palette', '07-command-palette');
    await page.keyboard.press('Escape');

    // 9. Settings Modal
    console.log('Auditing Settings Modal...');
    // Click settings in sidebar or trigger modal
    const settingsBtn = await page.$('button[title*="Settings"], button:has-text("Settings")');
    if (settingsBtn) {
      await settingsBtn.click();
      await page.waitForTimeout(500);
      await auditCurrentView('Settings Modal', '08-settings-modal');
      await page.keyboard.press('Escape');
    }

    // Output Report
    console.log('\n======================================================');
    console.log('        PLAYWRIGHT MONOCHROME AUDIT REPORT             ');
    console.log('======================================================\n');

    if (allViolations.length === 0) {
      console.log('✓ PASS: Zero non-monochrome computed style violations found across all audited pages!');
      console.log(`✓ Screenshots saved to ${screenshotDir}`);
      await browser.close();
      process.exit(0);
    } else {
      console.error(`✗ FAIL: Found ${allViolations.length} non-monochrome computed style violations:\n`);
      const groupedByPage: Record<string, Violation[]> = {};
      for (const v of allViolations) {
        if (!groupedByPage[v.page]) groupedByPage[v.page] = [];
        groupedByPage[v.page].push(v);
      }

      for (const [p, list] of Object.entries(groupedByPage)) {
        console.error(`\n--- Page: ${p} (${list.length} violations) ---`);
        for (const item of list.slice(0, 15)) {
          console.error(`  • [${item.selector}] <${item.tag}> "${item.text}": ${item.property} = ${item.rgb}`);
        }
        if (list.length > 15) {
          console.error(`  ... and ${list.length - 15} more on this page`);
        }
      }
      console.log(`\nScreenshots saved to ${screenshotDir}`);
      await browser.close();
      process.exit(1);
    }
  } catch (err: any) {
    console.error('Audit execution error:', err.message);
    await browser.close();
    process.exit(1);
  }
}

runMonoCheck();
