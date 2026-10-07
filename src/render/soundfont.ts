import { createReadStream, existsSync, openSync, readSync, closeSync, realpathSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import { createHash } from 'node:crypto';
import { diagnostic, type Parsed } from '../diagnostics.ts';
import type { Soundfont } from './renderer.ts';
export const DEFAULT_SOUNDFONTS = ['/usr/share/sounds/sf2/FluidR3_GM.sf2','/usr/share/soundfonts/FluidR3_GM.sf2','/usr/share/sounds/sf2/default-GM.sf2','/usr/share/soundfonts/default.sf2'] as const;
export async function resolveSoundfont(options: { soundfont?: string; env: NodeJS.ProcessEnv; defaults?: readonly string[] }): Promise<Parsed<Soundfont>> {
  const defaults=options.defaults??DEFAULT_SOUNDFONTS;
  const explicit=options.soundfont??(options.env.DAEMONV12_SOUNDFONT||undefined);
  const path=explicit??defaults.find(p=>existsSync(p));
  const hint='sudo apt-get install -y fluid-soundfont-gm, or pass --soundfont <file.sf2>.';
  if(path===undefined)return {diagnostic:diagnostic('SOUNDFONT_NOT_FOUND','',[...defaults],'installed GM SoundFont',hint)};
  let fd:number|undefined;
  try {
    const stat=statSync(path);
    if(!stat.isFile())return {diagnostic:diagnostic('SOUNDFONT_INVALID','',path,'readable regular RIFF/sfbk SoundFont file')};
    fd=openSync(path,'r');const header=Buffer.alloc(12);const size=readSync(fd,header,0,12,0);closeSync(fd);fd=undefined;
    if(size!==12 || header.toString('ascii',0,4)!=='RIFF' || header.toString('ascii',8,12)!=='sfbk')return {diagnostic:diagnostic('SOUNDFONT_INVALID','',path,'RIFF....sfbk magic in the first 12 bytes')};
    const hash=createHash('sha256');for await(const chunk of createReadStream(path))hash.update(chunk);
    return {value:{path,file:basename(realpathSync(path)),bytes:stat.size,sha256:hash.digest('hex')}};
  } catch(error) {
    return {diagnostic:diagnostic((error as NodeJS.ErrnoException).code==='ENOENT'?'SOUNDFONT_NOT_FOUND':'SOUNDFONT_INVALID','',path,'readable regular RIFF/sfbk SoundFont file',hint)};
  } finally { if(fd!==undefined)closeSync(fd); }
}
