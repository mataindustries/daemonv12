// Copy canonical bytes and losslessly archive aligned stems; no audio processing.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {gzipSync} from 'node:zlib';
const root=path.dirname(fileURLToPath(import.meta.url));
const source=path.join(root,'renders/final-a'),dest=path.join(root,'final');
fs.mkdirSync(dest,{recursive:true});fs.mkdirSync(path.join(root,'scratch'),{recursive:true});
for(const suffix of ['wav','mid','analysis.json','render.json'])fs.copyFileSync(path.join(source,'project.'+suffix),path.join(dest,'project.'+suffix));
fs.copyFileSync(path.join(source,'project.mp3'),path.join(root,'listening-copy.mp3'));
const tar=path.join(root,'scratch/stems.tar');
execFileSync('tar',['--sort=name','--mtime=@0','--owner=0','--group=0','--numeric-owner','--format=ustar','-cf',tar,'project.stems'],{cwd:source});
const compressed=gzipSync(fs.readFileSync(tar),{level:9});
if(compressed.readUInt32LE(4)!==0)throw new Error('Unexpected gzip timestamp');
const archive=path.join(dest,'stems.tar.gz');fs.writeFileSync(archive,compressed);fs.unlinkSync(tar);
const stems=[];
for(const name of fs.readdirSync(path.join(source,'project.stems')).filter(x=>x.endsWith('.wav')).sort()){
  const file='project.stems/'+name,original=fs.readFileSync(path.join(source,file));
  const archived=execFileSync('tar',['-xOf',archive,file],{maxBuffer:16*1024*1024});
  if(!original.equals(archived))throw new Error('Archive mismatch: '+file);
  stems.push({file,bytes:original.length,sha256:createHash('sha256').update(original).digest('hex')});
}
fs.writeFileSync(path.join(dest,'stems-index.json'),JSON.stringify({archive:'stems.tar.gz',losslessVerification:true,stems},null,2)+'\n');
console.log(JSON.stringify({copiedCanonicalMaster:true,archivedStems:stems.length,archiveBytes:compressed.length}));
