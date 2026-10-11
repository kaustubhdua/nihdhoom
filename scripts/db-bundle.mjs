#!/usr/bin/env node
/**
 * Builds the SQL bundle for a fresh NIRDHOOM database.
 * The checked-in manifest is explicit because several historical filenames share
 * prefixes and production's migration ledger has legacy server-assigned versions.
 *
 *   npm run db:bundle
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'supabase', 'migrations');
const manifest = path.join(root, 'supabase', 'migration-order.txt');
const outFile = path.join(root, 'supabase', 'all-migrations.sql');

export function migrationOrder(names, manifestNames) {
  if (!Array.isArray(manifestNames)) throw new Error('Pass the explicit supabase/migration-order.txt manifest');
  const actual = names.filter((name) => name.endsWith('.sql')).sort();
  const ordered = manifestNames.filter(Boolean);
  if (new Set(ordered).size !== ordered.length) {
    throw new Error('supabase/migration-order.txt contains duplicate migration filenames');
  }
  const missing = ordered.filter((name) => !actual.includes(name));
  const unlisted = actual.filter((name) => !ordered.includes(name));
  if (missing.length || unlisted.length) {
    throw new Error([
      'Migration manifest and supabase/migrations do not match.',
      missing.length ? `Missing files: ${missing.join(', ')}` : '',
      unlisted.length ? `Unlisted files: ${unlisted.join(', ')}` : '',
      'Do not silently bundle an unreviewed migration.'
    ].filter(Boolean).join('\n'));
  }
  return ordered;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const names = migrationOrder(
    fs.readdirSync(dir),
    fs.readFileSync(manifest, 'utf8').split(/\r?\n/).map((name) => name.trim()).filter(Boolean)
  );
  const parts = [
    '-- NIRDHOOM: approved fresh-install migrations in explicit release order.',
    '-- This bundle is for a NEW project only. Do not paste into an existing production database.',
    '-- Production history uses legacy server-assigned migration versions; see docs/DATABASE-RELEASE-LEDGER.md.',
    '-- The buyer-offer/transport workflow proposal is intentionally excluded until its staging authorization matrix passes.',
    `-- Generated ${new Date().toISOString().slice(0, 10)} from ${names.length} approved migrations.`,
    '',
  ];
  for (const name of names) {
    parts.push(`-- >>> ${name}`);
    parts.push(fs.readFileSync(path.join(dir, name), 'utf8').trimEnd());
    parts.push('');
  }
  fs.writeFileSync(outFile, parts.join('\n'));
  console.log(`Wrote ${path.relative(root, outFile)} (${names.length} migrations, ${(fs.statSync(outFile).size / 1024).toFixed(0)} KB).`);
  names.forEach((name, index) => console.log(`${String(index + 1).padStart(2)}. ${name}`));
}
