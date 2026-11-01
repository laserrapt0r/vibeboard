'use strict';
// Gemeinsames für die Browsertests. Aufruf über run.js, siehe dort.
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pp = require('puppeteer-core');

const BASE = process.env.BASE || 'http://127.0.0.1:3310';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-browser-'));
const FIXTURES = path.join(__dirname, 'fixtures') + path.sep;

const launch = (extraArgs = []) => pp.launch({
  executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
  headless: 'new',
  // Die Prüfungen erwarten die deutsche Oberfläche, unabhängig vom Rechner
  env: { ...process.env, LANG: 'de_DE.UTF-8', LANGUAGE: 'de' },
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1280,900', '--js-flags=--max-old-space-size=512', '--lang=de-DE', '--accept-lang=de-DE,de', ...extraArgs],
  defaultViewport: { width: 1280, height: 900 },
});

const login = async (page, email, pw) => {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle0' });
  await page.type('input[autocomplete=username]', email);
  await page.type('input[type=password]', pw);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.keyboard.press('Enter')]);
};

// Server steuern: Über VB_SERVER_CMD lässt sich das ersetzen, etwa durch „docker {action} vb-app“
const server = (action) => {
  const cmd = process.env.VB_SERVER_CMD || `node ${path.join(__dirname, 'serverctl.js')} {action}`;
  execSync(cmd.replace('{action}', action), { stdio: 'ignore' });
};

module.exports = { BASE, TMP, FIXTURES, launch, login, server };
