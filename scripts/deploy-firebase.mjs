#!/usr/bin/env node
/**
 * deploy-firebase.mjs — deploy dist/ to a Firebase Hosting SITE via the
 * Hosting REST API, authenticated with a service-account key.
 *
 * Why not the firebase CLI? On Umar's setup firebase-tools rejects
 * service-account auth, so (like NeighborMart) we talk to the API directly:
 *   1. Exchange the SA key for an OAuth2 access token (JWT bearer grant).
 *   2. Create the Hosting site if it doesn't exist yet.
 *   3. Create a version → populateFiles (sha256 of GZIPPED files)
 *      → upload the files Firebase asks for → finalize → release.
 *
 * Usage:
 *   node scripts/deploy-firebase.mjs --site umar-portfolio
 *   SITE_ID=umar-portfolio node scripts/deploy-firebase.mjs
 * Env:
 *   SITE_ID            (default: rope-portfolio; --site flag wins if given)
 *   FIREBASE_PROJECT   (default: neighbormart-7eff0)
 *   SA_KEY_PATH        (default: ~/.config/neighbormart/service-account.json)
 *   DIST_DIR           (default: ./dist)
 *
 * The main NeighborMart site is never touched — `--site` selects the
 * target site explicitly.
 */
import { createSign, createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { homedir } from 'node:os';
import { gzipSync } from 'node:zlib';

const args = process.argv.slice(2);
const flagSite = args.includes('--site') ? args[args.indexOf('--site') + 1] : undefined;
const siteId = flagSite ?? process.env.SITE_ID ?? 'rope-portfolio';
if (!siteId) {
  console.error('Usage: node scripts/deploy-firebase.mjs --site <site-id>');
  process.exit(2);
}
const PROJECT = process.env.FIREBASE_PROJECT ?? 'neighbormart-7eff0';
const SA_PATH =
  process.env.SA_KEY_PATH ??
  join(homedir(), '.config/neighbormart/service-account.json');
const DIST = process.env.DIST_DIR ?? 'dist';
const API = 'https://firebasehosting.googleapis.com/v1beta1';

// ---------------------------------------------------------------- token ----
const sa = JSON.parse(readFileSync(SA_PATH, 'utf8'));
const b64url = (buf) =>
  Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const jwt = `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ---------------------------------------------------------------- helpers --
async function api(token, method, url, body) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  return { status: res.status, json };
}

function walk(dir, base = dir, out = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, base, out);
    else out[`/${relative(base, full).split('\\').join('/')}`] = full;
  }
  return out;
}

// ---------------------------------------------------------------- main -----
const token = await getAccessToken();
console.log(`✓ OAuth token acquired for ${sa.client_email}`);

// 1. Create the site if needed ----------------------------------------------
const createRes = await api(
  token, 'POST',
  `${API}/projects/${PROJECT}/sites?site_id=${encodeURIComponent(siteId)}`,
  {},
);
if (createRes.status === 200) console.log(`✓ Created site "${siteId}"`);
else if (createRes.status === 409) console.log(`• Site "${siteId}" already exists`);
else {
  throw new Error(
    `Site creation failed (${createRes.status}): ${JSON.stringify(createRes.json)}`,
  );
}

const site = `projects/${PROJECT}/sites/${siteId}`;

// 2. Create a version ---------------------------------------------------------
const versionRes = await api(token, 'POST', `${API}/${site}/versions`, {
  status: 'CREATED',
  config: {
    rewrites: [{ glob: '**', path: '/index.html' }],
    headers: [
      { glob: '/index.html', headers: { 'Cache-Control': 'no-cache' } },
      {
        glob: '**/*.@(js|css|webp|svg|glb)',
        headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
      },
    ],
  },
});
if (versionRes.status !== 200) {
  throw new Error(`Version creation failed: ${JSON.stringify(versionRes.json)}`);
}
const versionName = versionRes.json.name;
console.log(`✓ Version created: ${versionName}`);

// 3. populateFiles with sha256 of gzipped content -----------------------------
const files = walk(DIST);
const hashes = {};
const gzipped = {};
for (const [path, file] of Object.entries(files)) {
  const gz = gzipSync(readFileSync(file));
  const hash = createHash('sha256').update(gz).digest('hex');
  hashes[path] = hash;
  gzipped[hash] = gz;
}
const popRes = await api(token, 'POST', `${API}/${versionName}:populateFiles`, {
  files: hashes,
});
if (popRes.status !== 200) {
  throw new Error(`populateFiles failed: ${JSON.stringify(popRes.json)}`);
}
const { uploadUrl, uploadRequiredHashes = [] } = popRes.json;
console.log(`• ${Object.keys(files).length} files known, ${uploadRequiredHashes.length} to upload`);

// 4. Upload required files ------------------------------------------------------
for (const hash of uploadRequiredHashes) {
  const res = await fetch(`${uploadUrl}/${hash}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: gzipped[hash],
  });
  if (res.status !== 200) throw new Error(`Upload failed for ${hash}: HTTP ${res.status}`);
}
console.log('✓ Uploads complete');

// 5. Finalize + release ---------------------------------------------------------
const finRes = await api(token, 'PATCH', `${API}/${versionName}?update_mask=status`, {
  status: 'FINALIZED',
});
if (finRes.status !== 200) {
  throw new Error(`Finalize failed: ${JSON.stringify(finRes.json)}`);
}
const relRes = await api(
  token, 'POST',
  `${API}/${site}/releases?version_name=${encodeURIComponent(versionName)}`,
  {},
);
if (relRes.status !== 200) {
  throw new Error(`Release failed: ${JSON.stringify(relRes.json)}`);
}
console.log(`🎉 LIVE: https://${siteId}.web.app/`);
