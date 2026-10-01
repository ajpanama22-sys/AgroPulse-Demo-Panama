"use client";
import {useUid,shade,palette,pos,neg,warn} from './core';
// Velocímetro con anillo biselado, arco de progreso y marca de meta.
export default function Gauge({value,min=0,max=100,target,label,display,good='high',accent=palette[0],sub}:{value:number|null;min?:number;max?:number;target?:number;label:string;display?:string;good?:'high'|'low';accent?:string;sub?:string}){
 const uid=useUid(),cx=150,cy=140,r=106,clamp=(v:number)=>Math.max(min,Math.min(max,v)),ang=(v:number)=>Math.PI+(clamp(v)-min)/(max-min)*Math.PI;
 const p=(a:number,rr=r)=>[Math.round((cx+rr*Math.cos(a))*100)/100,Math.round((cy+rr*Math.sin(a))*100)/100],arc=(a0:number,a1:number,rr=r)=>{const [x0,y0]=p(a0,rr),[x1,y1]=p(a1,rr);return `M${x0} ${y0}A${rr} ${rr} 0 ${a1-a0>Math.PI?1:0} 1 ${x1} ${y1}`;};
 const v=value??min,ok=target==null?true:good==='high'?v>=target:v<=target,color=target==null?accent:ok?pos:Math.abs(v-target)/(max-min)<.05?warn:neg,a=ang(v);
 return <div className="c3-gauge"><svg viewBox="0 -20 300 206" role="img" aria-label={`${label}: ${display??v}`}>
  <defs><linearGradient id={`${uid}-ring`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff"/><stop offset="1" stopColor="var(--c3-ring)"/></linearGradient><linearGradient id={`${uid}-arc`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={shade(color,-.15)}/><stop offset="1" stopColor={shade(color,.25)}/></linearGradient><filter id={`${uid}-s`} x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0b2233" floodOpacity=".25"/></filter></defs>
  <path d={arc(Math.PI,2*Math.PI,r+12)} stroke={`url(#${uid}-ring)`} strokeWidth="6" fill="none" strokeLinecap="round"/>
  <path d={arc(Math.PI,2*Math.PI)} stroke="var(--c3-track)" strokeWidth="20" fill="none" strokeLinecap="round"/>
  {value!=null&&<path d={arc(Math.PI,a)} stroke={`url(#${uid}-arc)`} strokeWidth="20" fill="none" strokeLinecap="round" pathLength={1} className="c3-draw" filter={`url(#${uid}-s)`}/>}
  {target!=null&&(()=>{const t=ang(target),[x0,y0]=p(t,r-16),[x1,y1]=p(t,r+16);return <g><line x1={x0} y1={y0} x2={x1} y2={y1} stroke="var(--ink)" strokeWidth="2.4"/><text x={p(t,r+30)[0]} y={p(t,r+30)[1]} textAnchor="middle" className="c3-axis">meta</text></g>;})()}
  <g className="c3-needle" style={{transformOrigin:`${cx}px ${cy}px`,transform:`rotate(${Math.round((a-Math.PI*1.5)*180/Math.PI*100)/100}deg)`}}><path d={`M${cx-5} ${cy}L${cx} ${cy-r+18}L${cx+5} ${cy}Z`} fill="var(--ink)" filter={`url(#${uid}-s)`}/></g>
  <circle cx={cx} cy={cy} r="11" fill="var(--panel)" stroke="var(--line)" strokeWidth="2"/>
  <text x={cx-r} y={cy+24} textAnchor="middle" className="c3-axis">{min}</text><text x={cx+r} y={cy+24} textAnchor="middle" className="c3-axis">{max}</text>
 </svg><div className="c3-gaugeText"><strong style={{color}}>{display??v}</strong><span>{label}</span>{sub&&<small>{sub}</small>}</div></div>;
}
