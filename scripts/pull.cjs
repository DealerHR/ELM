#!/usr/bin/env node
/*
  Pulls the files that changed on GitHub since a given commit into this Bolt project.

    node scripts/pull.cjs <since-sha>        files changed between <since-sha> and main
    node scripts/pull.cjs --files a.ts b.ts  specific files

  Works with a private repository when GITHUB_TOKEN is set (a fine-grained
  token with read access to Contents on DealerHR/ELM). Without a token it
  falls back to the public raw URL, which only works while the repo is public.
  Each file is verified non-empty and retried before it is written; files
  removed on GitHub are deleted here too.
*/
const https = require('https'), fs = require('fs'), path = require('path');
const OWNER = 'DealerHR', REPO = 'ELM', BRANCH = 'main';
const token = process.env.GITHUB_TOKEN;
const headers = { 'User-Agent': 'elm-pull', ...(token ? { Authorization: `Bearer ${token}` } : {}) };

const get = (url, accept) => new Promise((resolve, reject) => {
  https.get(url, { headers: { ...headers, Accept: accept } }, r => {
    let d = ''; r.on('data', c => d += c); r.on('end', () => resolve({ status: r.statusCode, body: d }));
  }).on('error', reject);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchFile(p, tries = 4) {
  const url = token
    ? `https://api.github.com/repos/${OWNER}/${REPO}/contents/${encodeURI(p)}?ref=${BRANCH}&t=${Date.now()}`
    : `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/${p}?t=${Date.now()}`;
  for (let i = 0; i < tries; i++) {
    const r = await get(url, token ? 'application/vnd.github.raw' : '*/*');
    if (r.status === 200 && r.body.length > 0) return r.body;
    if (r.status === 404 && i === tries - 1) return null;
    await sleep(1500);
  }
  return null;
}

async function changedSince(sha) {
  const r = await get(`https://api.github.com/repos/${OWNER}/${REPO}/compare/${sha}...${BRANCH}`, 'application/vnd.github+json');
  if (r.status !== 200) throw new Error(`compare failed (${r.status}): ${r.body.slice(0, 200)}${token ? '' : ' — set GITHUB_TOKEN for a private repo'}`);
  const j = JSON.parse(r.body);
  return { files: j.files.map(f => ({ path: f.filename, removed: f.status === 'removed', from: f.previous_filename })), head: j.commits.length ? j.commits[j.commits.length - 1].sha : sha };
}

(async () => {
  const args = process.argv.slice(2);
  let list;
  if (args[0] === '--files') list = args.slice(1).map(p => ({ path: p, removed: false }));
  else if (args[0]) { const c = await changedSince(args[0]); list = c.files; console.log(`${list.length} file(s) changed since ${args[0].slice(0, 7)} (head ${c.head.slice(0, 7)})`); }
  else { console.log('usage: node scripts/pull.cjs <since-sha> | --files <paths…>'); process.exit(1); }

  let ok = 0, fail = 0;
  for (const f of list) {
    if (f.from && f.from !== f.path) { try { fs.unlinkSync(f.from); console.log('moved  ', f.from, '→', f.path); } catch {} }
    if (f.removed) { try { fs.unlinkSync(f.path); console.log('removed', f.path); } catch {} continue; }
    if (f.path.startsWith('dist/') || f.path === 'package-lock.json') continue; // Bolt builds these itself
    const body = await fetchFile(f.path);
    if (body === null) { console.log('FAIL   ', f.path); fail++; continue; }
    fs.mkdirSync(path.dirname(f.path), { recursive: true });
    fs.writeFileSync(f.path, body);
    console.log('done   ', f.path); ok++;
  }
  console.log(`\n${ok} written, ${fail} failed${fail ? ' — run again or ask for help' : ''}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
