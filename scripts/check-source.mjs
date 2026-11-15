import {readFile, readdir, access} from 'node:fs/promises';
import {join, relative, posix, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';

const root=fileURLToPath(new URL('../',import.meta.url));
const excluded=new Set(['.git','node_modules','dist','artifacts','screenshots','captures','downloads','browser-profiles','test-results','playwright-report','.idea','.vscode']);
const internal=new Set(['PROGRESS.md','docs/COUNCIL-LOG.md','docs/AGENT-FILES-INDEX.md']);
const files=[];
async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const path=join(dir,entry.name),rel=relative(root,path).replaceAll('\\','/');
    if(excluded.has(entry.name)||entry.name.startsWith('.test-profile')||internal.has(rel)||rel.startsWith('docs/reviews/'))continue;
    if(entry.isSymbolicLink())throw Error('Public source must not contain symlinks: '+rel);
    if(entry.isDirectory()){await walk(path);continue;}
    if(/(?:^|\/)(?:\.env(?:\..*)?|.*\.(?:zip|crx|pem|key|log|har|pcap|dmp|sqlite3?))$/i.test(rel))continue;
    files.push(rel);
  }
}
await walk(root);files.sort();const publicFiles=new Set(files);
const failures=[];const requireCondition=(ok,message)=>{if(!ok)failures.push(message);};
const read=path=>readFile(join(root,path));
let documentLinks=0,syntaxChecks=0;
for(const path of files){
  const data=await read(path);
  if(path.endsWith('.png')){
    for(let offset=8;offset+12<=data.length;){
      const size=data.readUInt32BE(offset),type=data.toString('ascii',offset+4,offset+8);
      requireCondition(!['tEXt','iTXt','zTXt','eXIf'].includes(type),'Review embedded image metadata: '+path);
      offset+=size+12;
    }
    continue;
  }
  const text=data.toString('utf8');
  requireCondition(!/(?:[A-Z]:\\Users\\|[A-Z]:\\AI Projects\\|\/home\/)/i.test(text),'Review personal filesystem path: '+path);
  requireCondition(!/(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\bsk-(?:or-v1-|proj-)?[A-Za-z0-9_-]{20,}|\bgh[pousr]_[A-Za-z0-9_]{20,}|\bAKIA[A-Z0-9]{16}\b)/.test(text),'Review credential signature: '+path);
  requireCondition(!/(?:chatgpt\.com\/c\/|t3:\/\/)/i.test(text),'Review private session link: '+path);
  if(path.endsWith('.md')){
    for(const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)){
      const target=match[1].split('#')[0];if(!target||/^(?:https?:|mailto:)/.test(target))continue;
      const resolved=posix.normalize(posix.join(posix.dirname(path),target));
      requireCondition(publicFiles.has(resolved),'Broken public-source link: '+path+' -> '+target);documentLinks++;
    }
  }
  if(/\.(?:js|mjs)$/.test(path)){
    const result=spawnSync(process.execPath,['--check',join(root,path)],{encoding:'utf8'});
    requireCondition(result.status===0,'JavaScript syntax failed: '+path);syntaxChecks++;
  }
}
const inventory=JSON.parse((await read('licensing/owner-code.json')).toString('utf8'));
requireCondition(inventory.licenseExpression==='Apache-2.0 OR 0BSD','Unexpected owner licence expression');
const scopePaths=new Set();
for(const entry of inventory.files){
  requireCondition(!scopePaths.has(entry.path),'Duplicate ownership scope path: '+entry.path);scopePaths.add(entry.path);
  requireCondition(publicFiles.has(entry.path),'Ownership scope file absent from public source: '+entry.path);
  const data=await read(entry.path);
  requireCondition(createHash('sha256').update(data).digest('hex')===entry.sha256,'Ownership scope hash changed; review provenance before updating: '+entry.path);
  if(entry.path!=='browsers/brave/scripts/icons.ps1')requireCondition(!data.toString('utf8').includes('\r\n'),'Unstable Git line endings in owner scope: '+entry.path);
}
const attributes=(await read('.gitattributes')).toString('utf8');
requireCondition(attributes.includes('* text=auto eol=lf')&&attributes.includes('/browsers/brave/scripts/icons.ps1 -text'),'Git attributes must preserve recorded ownership scope bytes');
const manifest=JSON.parse((await read('browsers/brave/extension/manifest.json')).toString('utf8'));
const pkg=JSON.parse((await read('browsers/brave/package.json')).toString('utf8'));
const lock=JSON.parse((await read('browsers/brave/package-lock.json')).toString('utf8'));
requireCondition(manifest.name==='Linis'&&pkg.name==='linis','Product name mismatch');
requireCondition([manifest.version,pkg.version,lock.version,lock.packages[''].version].every(v=>v==='1.0.0'),'Version mismatch');
requireCondition(pkg.license==='Apache-2.0'&&lock.packages[''].license==='Apache-2.0','Default project licence mismatch');
for(const file of ['LICENSE','LICENSES/0BSD.txt','README.md','CONTRIBUTING.md','SECURITY.md','PRIVACY.md','LICENSING.md','OWNERSHIP.md','THIRD_PARTY_NOTICES.md','browsers/brave/tests/feed-fixture.mjs'])requireCondition(publicFiles.has(file),'Required public source file missing: '+file);
for(const [size,path] of Object.entries(manifest.icons)){
  const data=await read('browsers/brave/extension/'+path);
  requireCondition(data.readUInt32BE(16)===Number(size)&&data.readUInt32BE(20)===Number(size),'Wrong icon dimensions: '+path);
}
for(const file of files.filter(f=>f.startsWith('browsers/brave/extension/')&&f.endsWith('.js'))){
  const text=(await read(file)).toString('utf8');
  for(const match of text.matchAll(/from\s*['"](\.[^'"]+)['"]/g))requireCondition(publicFiles.has(posix.normalize(posix.join(posix.dirname(file),match[1]))),'Missing runtime import: '+file);
}
const app=(await read('browsers/brave/extension/app.html')).toString('utf8');
for(const match of app.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^https?:/.test(match[1]))requireCondition(publicFiles.has('browsers/brave/extension/'+match[1]),'Missing HTML asset: '+match[1]);
if(failures.length){for(const failure of failures)console.error(failure);process.exitCode=1;}
else console.log(JSON.stringify({publicSourceFiles:files.length,syntaxChecks,documentLinks,ownershipSnapshots:inventory.files.length,checks:'passed'},null,2));
