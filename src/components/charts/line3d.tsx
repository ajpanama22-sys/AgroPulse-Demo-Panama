"use client";
import {useState} from 'react';
import {palette,shade,niceTicks,compact,defaultFormat,useTooltip,useUid,pos,neg} from './core';
export type Series={name:string;values:(number|null)[];color?:string;dashed?:boolean;area?:boolean};
type Props={labels:string[];series:Series[];format?:(v:number|null)=>string;axisFormat?:(v:number)=>string;height?:number;label?:string;onSelect?:(i:number)=>void;zero?:boolean};
export default function Line3D({labels,series,format=defaultFormat,axisFormat=compact,height=300,label='Gráfica de línea',onSelect,zero=false}:Props){
 const uid=useUid(),{ref,show,hide,node}=useTooltip(),[active,setActive]=useState<number|null>(null);
 const W=680,H=height,L=64,R=26,T=26,B=labels.length>8?64:44;
 const all=series.flatMap(s=>s.values.filter((v):v is number=>v!=null));if(!all.length)return <p className="c3-empty">Sin datos para este rango.</p>;
 let min=Math.min(...all),max=Math.max(...all);if(zero){min=Math.min(0,min);max=Math.max(0,max);}else{const pad=(max-min)*.15||Math.abs(max)*.1||1;min-=pad;max+=pad;}
 const ticks=niceTicks(min,max,4),lo=ticks[0],hi=ticks.at(-1)!,n=labels.length;
 const x=(i:number)=>L+(n<=1?(W-L-R)/2:i*(W-L-R)/(n-1)),y=(v:number)=>T+(hi-v)/(hi-lo||1)*(H-T-B);
 const every=Math.max(1,Math.ceil(n/10));
 const pts=(s:Series)=>s.values.map((v,i)=>v==null?null:[x(i),y(v)]).filter(Boolean) as number[][];
 const path=(p:number[][])=>p.map((q,i)=>(i?'L':'M')+q[0].toFixed(1)+' '+q[1].toFixed(1)).join('');
 const at=(i:number)=>{const lines:[string,string,string?][]=series.map(s=>[s.name,format(s.values[i])]);const s0=series[0].values;if(i>0&&s0[i]!=null&&s0[i-1]!=null&&s0[i-1]!==0){const d=(s0[i]!-s0[i-1]!)/Math.abs(s0[i-1]!)*100;lines.push(['vs. período anterior',`${d>=0?'▲ +':'▼ '}${d.toLocaleString('es-PA',{maximumFractionDigits:1})} %`,d>=0?pos:neg]);}if(series[1]&&s0[i]!=null&&series[1].values[i]){const d=s0[i]!/series[1].values[i]!*100;lines.push([`% de ${series[1].name.toLowerCase()}`,`${d.toLocaleString('es-PA',{maximumFractionDigits:1})} %`]);}return lines;};
 return <div className="c3-wrap" ref={ref} onMouseLeave={()=>{hide();setActive(null);}}>
  <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="c3-svg">
   <defs>{series.map((s,k)=>{const c=s.color??palette[k%palette.length];return <g key={k}><linearGradient id={`${uid}-a${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c} stopOpacity=".34"/><stop offset="1" stopColor={c} stopOpacity=".02"/></linearGradient><linearGradient id={`${uid}-l${k}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={shade(c,.35)}/><stop offset="1" stopColor={shade(c,-.2)}/></linearGradient><radialGradient id={`${uid}-p${k}`} cx="30%" cy="25%" r="75%"><stop offset="0" stopColor="#ffffff"/><stop offset=".35" stopColor={shade(c,.35)}/><stop offset="1" stopColor={shade(c,-.3)}/></radialGradient></g>;})}
    <filter id={`${uid}-blur`} x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="3"/></filter></defs>
   <path d={`M${L} ${H-B}H${W-R}l14 10H${L+14}Z`} fill="var(--c3-floor)" opacity=".6"/>
   {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} className={t===0&&lo<0?'c3-zero':'c3-grid'}/><text x={L-10} y={y(t)+4} textAnchor="end" className="c3-axis">{axisFormat(t)}</text></g>)}
   {labels.map((l,i)=>(i%every===0||i===n-1)&&<text key={i} x={x(i)} y={H-B+20} textAnchor={n>8?'end':'middle'} transform={n>8?`rotate(-30 ${x(i)} ${H-B+20})`:undefined} className="c3-label">{l}</text>)}
   {active!=null&&<line x1={x(active)} x2={x(active)} y1={T} y2={H-B} className="c3-guide"/>}
   {series.map((s,k)=>{const p=pts(s),c=s.color??palette[k%palette.length];if(!p.length)return null;return <g key={k}>
    {s.area!==false&&!s.dashed&&p.length>1&&<path d={`${path(p)}L${p.at(-1)![0]} ${H-B}L${p[0][0]} ${H-B}Z`} fill={`url(#${uid}-a${k})`} className="c3-fade"/>}
    {!s.dashed&&<path d={path(p)} transform="translate(0 7)" fill="none" stroke="#0b2233" strokeOpacity=".16" strokeWidth="6" filter={`url(#${uid}-blur)`}/>}
    <path d={path(p)} fill="none" stroke={s.dashed?c:`url(#${uid}-l${k})`} strokeWidth={s.dashed?2.2:4.2} strokeDasharray={s.dashed?'7 6':undefined} strokeLinecap="round" strokeLinejoin="round" pathLength={s.dashed?undefined:1} className={s.dashed?'c3-fade':'c3-draw'}/>
    {!s.dashed&&<path d={path(p)} transform="translate(0 -1.2)" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1" strokeLinecap="round"/>}
    {!s.dashed&&s.values.map((v,i)=>v==null?null:<circle key={i} cx={x(i)} cy={y(v)} r={active===i?7:n>24?2.4:4.8} fill={`url(#${uid}-p${k})`} stroke="#fff" strokeWidth="1.2" className="c3-fade"/>)}
   </g>;})}
   {labels.map((l,i)=><rect key={i} x={x(i)-Math.max(6,(W-L-R)/Math.max(1,n-1)/2)} y={T} width={Math.max(12,(W-L-R)/Math.max(1,n-1))} height={H-T-B} fill="transparent" tabIndex={0} role="button" aria-label={`${l}: ${series.map(s=>`${s.name} ${format(s.values[i])}`).join(', ')}`} onMouseMove={e=>{setActive(i);show(e,e.currentTarget,l,at(i));}} onFocus={e=>{setActive(i);show(null,e.currentTarget,l,at(i));}} onBlur={hide} onClick={()=>onSelect?.(i)} style={{cursor:onSelect?'pointer':'crosshair',outline:'none'}}/>)}
  </svg>
  {series.length>1&&<ul className="c3-legend inline">{series.map((s,k)=><li key={k}><span><i className={s.dashed?'dash':''} style={{background:s.color??palette[k%palette.length]}}/>{s.name}</span></li>)}</ul>}
  {node}</div>;
}
