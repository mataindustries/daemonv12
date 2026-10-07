/** Read-only, offline spectral QC. Unweighted power, not perceived loudness.
 * node scripts/inspect-orbital-foundry.ts [audition.wav] > spectral.json
 * 8192-point Hann windows, 50% overlap, channels measured separately (no mono cancellation).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodePcm } from '../src/render/index.ts';
const N=8192, RATE=44100;
const edges=[0,30,120,500,2000,6000,12000,22050];
function fft(re:Float64Array,im:Float64Array) {
  for(let i=1,j=0;i<N;i++) {let bit=N>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j]!,re[i]!];}}
  for(let size=2;size<=N;size*=2)for(let base=0;base<N;base+=size)for(let j=0;j<size/2;j++) {
    const a=-2*Math.PI*j/size,c=Math.cos(a),s=Math.sin(a),k=base+j,h=k+size/2;
    const tr=c*re[h]!-s*im[h]!,ti=s*re[h]!+c*im[h]!;
    re[h]=re[k]!-tr;im[h]=im[k]!-ti;re[k]!+=tr;im[k]!+=ti;
  }
}
export function inspect(path:string) {
  const decoded=decodePcm(readFileSync(path));if(!decoded.pcm)throw new Error(decoded.error);
  const {samples,frames,channels}=decoded.pcm,power=Array<number>(edges.length-1).fill(0);
  for(let start=-N/2;start<frames;start+=N/2)for(let c=0;c<channels;c++) {
    const re=new Float64Array(N),im=new Float64Array(N);
    for(let i=0;i<N;i++)re[i]=(samples[(start+i)*channels+c]??0)/32768*(0.5-0.5*Math.cos(2*Math.PI*i/(N-1)));
    fft(re,im);
    for(let k=0;k<=N/2;k++) {
      const hz=k*RATE/N,b=Math.min(power.length-1,edges.findIndex(e=>e>hz)-1);
      const band=b<0?power.length-1:b;
      power[band]!+=(re[k]!**2+im[k]!**2)*(k===0||k===N/2?1:2);
    }
  }
  const total=power.reduce((a,b)=>a+b,0);
  let peak=0,energy=0,mean=0,clipped=0,lr=0,ll=0,rr=0;
  for(let i=0;i<samples.length;i++){const x=samples[i]!/32768;peak=Math.max(peak,Math.abs(x));energy+=x*x;mean+=x;if(samples[i]===32767||samples[i]===-32768)clipped++;}
  if(channels===2)for(let i=0;i<samples.length;i+=2){const l=samples[i]!,r=samples[i+1]!;lr+=l*r;ll+=l*l;rr+=r*r;}
  const db=(v:number)=>v>0?Number((20*Math.log10(v)).toFixed(3)):null;
  return {file:path,seconds:frames/RATE,channels,peakDbfs:db(peak),rmsDbfs:db(Math.sqrt(energy/samples.length)),dc:mean/samples.length,clippedSamples:clipped,stereoCorrelation:channels===2?Number((lr/Math.sqrt(ll*rr)).toFixed(4)):null,
    bandPowerPercent:Object.fromEntries(power.map((p,i)=>[`${edges[i]}-${edges[i+1]} Hz`,Number((100*p/total).toFixed(2))])),
    perSecondRmsDbfs:Array.from({length:Math.ceil(frames/RATE)},(_,second)=>{let sum=0,count=0;for(let i=second*RATE*channels;i<Math.min(samples.length,(second+1)*RATE*channels);i++){sum+=(samples[i]!/32768)**2;count++;}return db(Math.sqrt(sum/count));})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const catalog=JSON.parse(readFileSync('examples/orbital-foundry.catalog.json','utf8'));
  console.log(JSON.stringify({method:'8192-point Hann FFT, 50% overlap; summed independent-channel power; unweighted bands; includes fades and silence',master:inspect(process.argv[2]??'renders/orbital-foundry/orbital-foundry-audition.wav'),sources:catalog.sounds.map((s:{file:string})=>inspect(`examples/${s.file}`))},null,2));
}
