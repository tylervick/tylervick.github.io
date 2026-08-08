#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { renderPage } from './build/html.mjs';

const root = new URL('./', import.meta.url);
const resume = JSON.parse(readFileSync(new URL('resume.json', root)));
const out = new URL('index.html', root);

writeFileSync(out, renderPage(resume));
console.log(`wrote ${out.pathname}`);
