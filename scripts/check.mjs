import {readFileSync, mkdtempSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
if(process.argv.includes('--inspect')) {
  for(const n of [11,13,27]) console.log(`LINE ${n}\n`+html.split('\n')[n-1].replace(/(.{1,170})(\s|$)/g,'$1\n'));
}
const dir=mkdtempSync(join(tmpdir(),'aria-check-'));
let count=0;
try {
  for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    if(/\bsrc=/.test(match[1])||/application\/json/.test(match[1])) continue;
    const file=join(dir,`inline-${++count}.js`); writeFileSync(file,match[2]);
    const check=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
    if(check.status!==0) throw new Error(check.stderr);
  }
  console.log(`PASS: ${count} inline JavaScript script(s) parsed`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length) throw new Error('Duplicate HTML IDs');
  console.log('PASS: unique static HTML IDs');
} finally { rmSync(dir,{recursive:true,force:true}); }
