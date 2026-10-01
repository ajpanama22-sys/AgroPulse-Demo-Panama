"use client";
import {palette,shade,niceTicks,compact,defaultFormat,useTooltip,useUid,pos,neg} from './core';
type Step={label:string;value:number;type:'total'|'delta'};
export default function Waterfall({steps,format=defaultFormat,axisFormat=compact,accent=palette[1],label='Cascada'}:{steps:Step[];format?:(v:number|null)=>string;axisFormat?:(v:number)=>string;accent?:string;label?:string}){
 const uid=useUid(),{ref,show,hide,node}=useTooltip();
 const W=680,H=320,L=64,R=24,T=28,B=70,depth=9;let run=0;
 const bars=steps.map(s=>{if(s.type==='total'){run=s.value;return {...s,from:0,to:s.value};}const from=run;run+=s.value;return {...s,from,to:run};});
 const vals=bars.flatMap(b=>[b.from,b.to]),ticks=niceTicks(Math.min(0,...vals),Math.max(...vals),4),lo=ticks[0],hi=ticks.at(-1)!;
 const y=(v:number)=>T+(hi-v)/(hi-lo||1)*(H-T-B),slot=(W-L-R-depth)/bars.length,bw=Math.min(62,slot*.6),base=bars[0]?.value||1;
 return <div className="c3-wrap" ref={ref} onMouseLeave={hide}><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="c3-svg">
  <defs>{bars.map((b,i)=>{const c=b.type==='total'?accent:b.value<0?neg:pos;return <linearGradient key={i} id={`${uid}-w${i}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={shade(c,.3)}/><stop offset=".6" stopColor={c}/><stop offset="1" stopColor={shade(c,-.12)}/></linearGradient>;})}</defs>
  <path d={`M${L} ${y(0)}H${W-R-depth}l${depth} ${-depth*.6}H${L+depth}Z`} fill="var(--c3-floor)" opacity=".55"/>
  {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} className={t===0?'c3-zero':'c3-grid'}/><text x={L-10} y={y(t)+4} textAnchor="end" className="c3-axis">{axisFormat(t)}</text></g>)}
  {bars.map((b,i)=>{const x=L+i*slot+(slot-bw)/2,top=y(Math.max(b.from,b.to)),bot=y(Math.min(b.from,b.to)),h=Math.max(1.5,bot-top),c=b.type==='total'?accent:b.value<0?neg:pos;
   const lines:[string,string,string?][]=[[b.type==='total'?'Total':'Impacto',format(b.value),b.type==='total'?undefined:b.value<0?neg:pos],['Sobre la venta bruta',`${(b.value/base*100).toLocaleString('es-PA',{maximumFractionDigits:1})} %`]];
   const enter=(e:any)=>show(e,e.currentTarget,b.label,lines);
   return <g key={i} className="c3-bar" style={{animationDelay:`${i*70}ms`,transformOrigin:`${x}px ${bot}px`}} tabIndex={0} role="img" aria-label={`${b.label}: ${format(b.value)}`} onMouseMove={enter} onFocus={enter} onBlur={hide}>
    {i<bars.length-1&&<line x1={x+bw} x2={x+slot+bw*.0} y1={y(b.to)} y2={y(b.to)} className="c3-connector"/>}
    <path d={`M${x+bw} ${top}l${depth} ${-depth*.6}V${bot-depth*.6}l${-depth} ${depth*.6}Z`} fill={shade(c,-.35)}/>
    <path d={`M${x} ${top}l${depth} ${-depth*.6}h${bw}l${-depth} ${depth*.6}Z`} fill={shade(c,.42)}/>
    <rect x={x} y={top} width={bw} height={h} fill={`url(#${uid}-w${i})`}/>
    <text x={x+bw/2+depth/2} y={top-depth*.6-7} textAnchor="middle" className="c3-val">{(b.value<0?'−':'')+axisFormat(Math.abs(b.value))}</text>
    <text x={x+bw/2} y={H-B+18} textAnchor="end" transform={`rotate(-28 ${x+bw/2} ${H-B+18})`} className="c3-label">{b.label}</text>
   </g>;})}
 </svg>{node}</div>;
}
