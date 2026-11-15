import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {join, relative} from 'node:path';
import {createHash} from 'node:crypto';

const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
const version=manifest.version;
// Runtime allowlist: exclude obsolete icons and files accidentally left in extension/.
const files=[
  'extension/manifest.json','extension/app.html','extension/app.css','extension/app.js','extension/background.js',
  ...['collector','export','highlight','jev','modes','settings'].map(name=>`extension/lib/${name}.js`),
  ...new Set([...Object.values(manifest.icons),...Object.values(manifest.action.default_icon)].map(name=>'extension/'+name))
];
await mkdir('dist/linis',{recursive:true});
const entries=[];
async function add(name,data){
  entries.push({name:'linis/'+name,data});
  const destination=join('dist/linis',name);
  await mkdir(join(destination,'..'),{recursive:true});
  await writeFile(destination,data);
}
for(const path of files){const name=relative('extension',path).replaceAll('\\','/');await add(name,await readFile(path));}
let releaseReadme=await readFile('scripts/RELEASE-README.md','utf8');
releaseReadme=releaseReadme.replaceAll('](../PRIVACY.md)','](PRIVACY.md)').replaceAll('](../TESTING.md)','](TESTING.md)').replaceAll('](../README.md)','](USAGE.md)').replaceAll('](../../../','](');
await add('README.md',Buffer.from(releaseReadme));
let usage=await readFile('README.md','utf8');
usage=usage.replaceAll('../../README.md','README.md').replaceAll('../../LICENSING.md','LICENSING.md').replaceAll('../../LICENSE','LICENSE');
await add('USAGE.md',Buffer.from(usage));
for(const name of ['PRIVACY.md','TESTING.md'])await add(name,await readFile(name));
for(const name of ['LICENSE','LICENSES/0BSD.txt','CONTRIBUTING.md','LICENSING.md','OWNERSHIP.md','licensing/owner-code.json','THIRD_PARTY_NOTICES.md']){
  let data=await readFile(join('../..',name));
  if(name==='CONTRIBUTING.md')data=Buffer.from(data.toString('utf8').replaceAll('(browsers/brave/TESTING.md)','(TESTING.md)'));
  await add(name,data);
}
const table=Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(buffer){let c=0xffffffff;for(const b of buffer)c=table[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
const local=[],central=[];let offset=0;
for(const {name,data} of entries){
  const nameBuffer=Buffer.from(name);const crc=crc32(data);
  const date=((2026-1980)<<9)|(11<<5)|15;
  const header=Buffer.alloc(30);header.writeUInt32LE(0x04034b50);header.writeUInt16LE(20,4);header.writeUInt16LE(0x800,6);header.writeUInt16LE(date,12);header.writeUInt32LE(crc,14);header.writeUInt32LE(data.length,18);header.writeUInt32LE(data.length,22);header.writeUInt16LE(nameBuffer.length,26);
  local.push(header,nameBuffer,data);
  const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(date,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(nameBuffer.length,28);c.writeUInt32LE(offset,42);central.push(c,nameBuffer);
  offset+=header.length+nameBuffer.length+data.length;
}
const centralBuffer=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(centralBuffer.length,12);end.writeUInt32LE(offset,16);
const zip=Buffer.concat([...local,centralBuffer,end]);const output=`dist/linis-${version}.zip`;await writeFile(output,zip);
const hash=createHash('sha256').update(zip).digest('hex');await writeFile(`${output}.sha256`,`${hash}  linis-${version}.zip\n`);
console.log(`${output} (${entries.length} files, ${zip.length} bytes)\nSHA-256 ${hash}`);
