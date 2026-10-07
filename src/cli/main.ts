import { parseArgs } from 'node:util';
import { diagnostic, formatDiagnosticHuman, type Diagnostic } from '../diagnostics.ts';
import { resultFor, runCommand, type Command, type CommandOptions, type CommandResult } from '../pipeline.ts';
import { ENGINE_VERSION } from '../version.ts';
const usage = `Usage:
  daemonv12 validate <project.json> [--json]
  daemonv12 midi <project.json> [--out-dir <dir>] [--json]
  daemonv12 render <project.json> [--out-dir <dir>] [--soundfont <file.sf2>] [--stems] [--format wav|mp3|wav,mp3] [--json]
  daemonv12 analyze <audio.wav> [--json]
  daemonv12 help | --help | -h
  daemonv12 --version | -v`;
function print(result: CommandResult, json: boolean, diagnostics: Diagnostic[] = [...result.errors,...result.warnings]): void {
  if (json) { process.stdout.write(JSON.stringify(result,null,2)+'\n'); return; }
  for (const d of diagnostics) process.stderr.write(formatDiagnosticHuman(d)+'\n');
  if (!result.ok) { process.stderr.write(`FAILED ${result.project??'(command)'}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`); if(result.omitted)process.stderr.write(`… and ${result.omitted} more\n`); return; }
  if(result.analysis && result.command==='analyze') {process.stdout.write(JSON.stringify(result.analysis,null,2)+'\n');return;}
  if (!result.summary) return;
  const s=result.summary;
  process.stdout.write(`OK ${result.project}\n  ${JSON.stringify(s.title)}: ${s.bars} bars of ${s.timeSignature} at ${s.bpm} BPM${s.key?`, ${s.key}`:''}, ${s.tracks} tracks, ${s.notes} notes, ${s.durationSeconds.toFixed(3)} s\n`);
  for (const [kind,file] of Object.entries(result.artifacts)) {
    if (kind==='stems') {
      for (const stem of result.artifacts.stems!) process.stdout.write(`  wrote ${stem.wav} (track ${stem.trackId})\n`);
      continue;
    }
    let detail='';
    if(kind==='wav' && result.manifest) {
      const wav=result.manifest.wav as {durationSeconds:number};
      const renderer=result.manifest.renderer as {name:string;version:string;settings:{sampleRate:number}};
      const sf=result.manifest.soundfont as {file:string}|null;
      detail=` (${wav.durationSeconds.toFixed(3)} s, ${renderer.settings.sampleRate} Hz, 16-bit stereo, ${renderer.name} ${renderer.version}${sf?`, ${sf.file}`:''})`;
    }
    process.stdout.write(`  wrote ${file}${detail}\n`);
  }
  if(result.omitted)process.stderr.write(`… and ${result.omitted} more\n`);
}
async function main(): Promise<void> {
  const argv=process.argv.slice(2), json=argv.includes('--json');
  let command: Command | null=null, project:string|null=null;
  let options: CommandOptions;
  try {
    const {positionals,values}=parseArgs({args:argv,strict:true,allowPositionals:true,options:{
      json:{type:'boolean'},format:{type:'string'},stems:{type:'boolean'},'out-dir':{type:'string'},soundfont:{type:'string'},help:{type:'boolean',short:'h'},version:{type:'boolean',short:'v'},
    }});
    const name=positionals[0];
    if(name==='validate'||name==='midi'||name==='render'||name==='analyze')command=name;
    project=positionals[1]??null;
    if ((values.help || name==='help') && positionals.length <= (name==='help'?1:0) && !values.version && values['out-dir']===undefined && values.soundfont===undefined && values.stems===undefined && values.format===undefined) { process.stdout.write(usage+'\n');return; }
    if(values.version && !positionals.length && !values.help && values['out-dir']===undefined && values.soundfont===undefined && values.stems===undefined && values.format===undefined){process.stdout.write(`daemonv12 ${ENGINE_VERSION}\n`);return;}
    if (!command || positionals.length!==2 || values.help || values.version || ((command==='validate'||command==='analyze') && values['out-dir']!==undefined) || (command!=='render' && (values.soundfont!==undefined || values.stems!==undefined || values.format!==undefined)) || (values.format!==undefined && !['wav','mp3','wav,mp3'].includes(values.format)))throw new Error('Invalid command, arguments, or command-specific flags.');
    options={outDir:values['out-dir'],soundfont:values.soundfont,stems:values.stems,format:values.format as CommandOptions['format'],env:process.env};
  } catch(error) {
    // parseArgs rejects malformed argv before returning positionals; preserve identifiable context.
    if (!command && ['validate','midi','render','analyze'].includes(argv[0]??'')) {command=argv[0] as Command;project=argv[1]&&!argv[1].startsWith('-')?argv[1]:null;}
    const d=diagnostic('USAGE_ERROR','',argv,'the documented CLI syntax',usage);
    d.message=error instanceof Error?error.message:String(error);
    print(resultFor(command,project,[d]),json);process.exitCode=2;return;
  }
  const outcome=await runCommand(command!,project!,options);
  print(outcome.result,json,outcome.diagnostics);
  if(outcome.stack&&!json)process.stderr.write(outcome.stack+'\n');
  process.exitCode=outcome.exitCode;
}
await main();
