import { parseArgs } from 'node:util';
import { diagnostic, formatDiagnosticHuman } from '../diagnostics.ts';
import { resultFor, runCommand, type Command, type CommandResult } from '../pipeline.ts';
import { ENGINE_VERSION } from '../version.ts';
const usage = `Usage:
  daemonv12 validate <project.json> [--json]
  daemonv12 midi <project.json> [--out-dir <dir>] [--json]
  daemonv12 render <project.json> [--out-dir <dir>] [--soundfont <file.sf2>] [--json]
  daemonv12 help | --help | -h
  daemonv12 --version | -v`;
function print(result: CommandResult, json: boolean): void {
  if (json) { process.stdout.write(JSON.stringify(result,null,2)+'\n'); return; }
  for (const d of [...result.errors,...result.warnings]) process.stderr.write(formatDiagnosticHuman(d)+'\n');
  if (result.omitted) process.stderr.write(`… and ${result.omitted} more\n`);
  if (!result.ok) { process.stderr.write(`FAILED ${result.project??'(command)'}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)\n`); return; }
  if (!result.summary) return;
  const s=result.summary;
  process.stdout.write(`OK ${result.project}\n  ${JSON.stringify(s.title)}: ${s.bars} bars of ${s.timeSignature} at ${s.bpm} BPM${s.key?`, ${s.key}`:''}, ${s.tracks} tracks, ${s.notes} notes, ${s.durationSeconds.toFixed(3)} s\n`);
  for (const file of Object.values(result.artifacts)) process.stdout.write(`  wrote ${file}\n`);
}
async function main(): Promise<void> {
  const argv=process.argv.slice(2), json=argv.includes('--json');
  let command: Command | null=null, project:string|null=null;
  try {
    const {positionals,values}=parseArgs({args:argv,strict:true,allowPositionals:true,options:{
      json:{type:'boolean'},'out-dir':{type:'string'},soundfont:{type:'string'},help:{type:'boolean',short:'h'},version:{type:'boolean',short:'v'},
    }});
    const name=positionals[0];
    if(name==='validate'||name==='midi'||name==='render')command=name;
    project=positionals[1]??null;
    if ((values.help || name==='help') && positionals.length <= (name==='help'?1:0) && !values.version && values['out-dir']===undefined && values.soundfont===undefined) { process.stdout.write(usage+'\n');return; }
    if(values.version && !positionals.length && !values.help && values['out-dir']===undefined && values.soundfont===undefined){process.stdout.write(`daemonv12 ${ENGINE_VERSION}\n`);return;}
    if (!command || positionals.length!==2 || values.help || values.version || (command==='validate' && values['out-dir']!==undefined) || (command!=='render' && values.soundfont!==undefined))throw new Error('Invalid command, arguments, or command-specific flags.');
    const outcome=await runCommand(command,project!,{outDir:values['out-dir'],soundfont:values.soundfont,env:process.env});
    print(outcome.result,json);if(outcome.stack&&!json)process.stderr.write(outcome.stack+'\n');process.exitCode=outcome.exitCode;
  } catch(error) {
    // parseArgs rejects malformed argv before returning positionals; preserve identifiable context.
    if (!command && ['validate','midi','render'].includes(argv[0]??'')) {command=argv[0] as Command;project=argv[1]&&!argv[1].startsWith('-')?argv[1]:null;}
    const d=diagnostic('USAGE_ERROR','',argv,'the documented CLI syntax',usage);
    d.message=error instanceof Error?error.message:String(error);
    print(resultFor(command,project,[d]),json);process.exitCode=2;
  }
}
await main();
