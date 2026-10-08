#!/usr/bin/env node
const args=process.argv.slice(2),mode=process.env.FAKE_AUDIO_MODE;
if(args.includes('-version')) {
  if(mode==='probe-hang')setInterval(()=>{},1000);
  else if(mode==='probe-fail')process.exitCode=1;
  else process.stdout.write('ffmpeg version fake-1\n');
}
else if(args.includes('-filters')) {
  if(mode==='filters-fail')process.exitCode=1;
  else process.stdout.write(['highpass','lowpass','aecho','loudnorm'].map(name=>` ... ${name} A->A\n`).join(''));
}
else if(args.includes('-encoders'))process.stdout.write(` A..... pcm_f64le PCM\n${mode==='missing-mp3'?'':' A....D libmp3lame MP3\n'}`);
else if(mode==='hang')setInterval(()=>{},1000);
else if(args.includes('mp3')) {process.stderr.write('encoder unavailable\n');process.exitCode=1;}
else if(mode==='malformed')process.stderr.write('{"input_i":"bad"}\n');
else process.stderr.write(JSON.stringify({input_i:'-20',input_tp:'-6',input_lra:'2'})+'\n');
