"use client";
import {useState} from 'react';
import {Item,palette,shade,defaultFormat,useTooltip,useUid,Legend} from './core';
type Props={items:Item[];format?:(v:number|null)=>string;centerLabel?:string;centerValue?:string;onSelect?:(it:Item,i:number)=>void;label?:string;compact?:boolean};
// Dona con perspectiva: cara superior, pared exterior frontal y pared interior trasera.
export default function Donut3D({items,format=defaultFormat,centerLabel='Total',centerValue,onSelect,label='Gráfica de dona',compact=false}:Props){
 const uid=useUid(),{ref,show,hide,node}=useTooltip(),[active,setActive]=useState<number|null>(null),[hidden,setHidden]=useState<Set<number>>(new Set());
 const shown=items.map((it,i)=>({...it,i,color:it.color??palette[i%palette.length]})).filter(it=>!hidden.has(it.i)&&(it.value??0)>0);
 const total=shown.reduce((s,it)=>s+(it.value??0),0),allTotal=items.reduce((s,it)=>s+Math.max(0,it.value??0),0);
 const cx=170,cy=118,rx=140,ry=84,k=.56,depth=24;
 const pt=(a:number,r=1,dy=0)=>[cx+rx*r*Math.cos(a),cy+ry*r*Math.sin(a)+dy];
 const arc=(a0:number,a1:number,r=1,dy=0,rev=false)=>{const steps=Math.max(2,Math.ceil(Math.abs(a1-a0)/.08)),out=[];for(let s=0;s<=steps;s++){const a=rev?a1-(a1-a0)*s/steps:a0+(a1-a0)*s/steps;out.push(pt(a,r,dy));}return out;};
 const poly=(p:number[][])=>'M'+p.map(q=>q[0].toFixed(2)+' '+q[1].toFixed(2)).join('L')+'Z';
 let a=-Math.PI/2;const slices=shown.map(it=>{const span=total?(it.value??0)/total*Math.PI*2:0,s={...it,a0:a,a1:a+span,mid:a+span/2};a+=span;return s;});
 const clip=(a0:number,a1:number,lo:number,hi:number)=>{const s=Math.max(a0,lo),e=Math.min(a1,hi);return e>s?[s,e]:null;};
 const ranges=(a0:number,a1:number,front:boolean)=>{const out=[];for(let base=-2*Math.PI;base<=2*Math.PI;base+=2*Math.PI){const r=front?clip(a0,a1,base,base+Math.PI):clip(a0,a1,base+Math.PI,base+2*Math.PI);if(r)out.push(r);}return out;};
 const off=(s:any)=>active===s.i?[Math.cos(s.mid)*10,Math.sin(s.mid)*6]:[0,0];
 if(!items.length||!allTotal)return <p className="c3-empty">Sin datos para este rango.</p>;
 return <div className={`c3-wrap c3-donut${compact?' compact':''}`} ref={ref} onMouseLeave={()=>{hide();setActive(null);}}>
  <svg viewBox="0 0 340 250" role="img" aria-label={label} className="c3-svg c3-pop">
   <defs>{slices.map(s=><linearGradient key={s.i} id={`${uid}-d${s.i}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={shade(s.color,.32)}/><stop offset="1" stopColor={shade(s.color,-.08)}/></linearGradient>)}
    <radialGradient id={`${uid}-sh`}><stop offset="0" stopColor="#0b2233" stopOpacity=".28"/><stop offset="1" stopColor="#0b2233" stopOpacity="0"/></radialGradient></defs>
   <ellipse cx={cx} cy={cy+depth+14} rx={rx*1.02} ry={ry*.62} fill={`url(#${uid}-sh)`}/>
   {slices.flatMap(s=>ranges(s.a0,s.a1,false).map(([r0,r1],n)=>{const [dx,dy]=off(s);return <path key={`in${s.i}-${n}`} transform={`translate(${dx} ${dy})`} d={poly([...arc(r0,r1,k),...arc(r0,r1,k,depth,true)])} fill={shade(s.color,-.45)}/>;}))}
   {slices.flatMap(s=>ranges(s.a0,s.a1,true).map(([r0,r1],n)=>{const [dx,dy]=off(s);return <path key={`out${s.i}-${n}`} transform={`translate(${dx} ${dy})`} d={poly([...arc(r0,r1,1),...arc(r0,r1,1,depth,true)])} fill={shade(s.color,-.3)}/>;}))}
   {slices.map(s=>{const [dx,dy]=off(s),pct=total?(s.value??0)/total*100:0,lines:[string,string][]=[['Valor',format(s.value)],['Participación',`${pct.toLocaleString('es-PA',{maximumFractionDigits:1})} %`]];const enter=(e:any)=>{setActive(s.i);show(e,e.currentTarget,s.label,lines);};
    return <path key={s.i} className={`c3-slice${onSelect?' click':''}`} transform={`translate(${dx} ${dy})`} d={poly([...arc(s.a0,s.a1,1),...arc(s.a0,s.a1,k,0,true)])} fill={`url(#${uid}-d${s.i})`} stroke="#ffffff" strokeOpacity=".55" strokeWidth="1" tabIndex={0} role="button" aria-label={`${s.label}: ${format(s.value)}, ${pct.toFixed(1)} %`} onMouseMove={enter} onFocus={enter} onBlur={hide} onClick={()=>onSelect?.(s,s.i)}/>;})}
   {slices.filter(s=>s.a1-s.a0>.32).map(s=>{const [x,y2]=pt(s.mid,(1+k)/2);const [dx,dy]=off(s);return <text key={'t'+s.i} x={x+dx} y={y2+dy+4} textAnchor="middle" className="c3-slicepct">{((s.value??0)/total*100).toLocaleString('es-PA',{maximumFractionDigits:0})}%</text>;})}
   <text x={cx} y={cy-4} textAnchor="middle" className="c3-center">{centerValue??format(total)}</text>
   <text x={cx} y={cy+14} textAnchor="middle" className="c3-centerlabel">{centerLabel}</text>
  </svg>
  <Legend items={items.map((it,i)=>({...it,color:it.color??palette[i%palette.length]}))} hidden={hidden} onToggle={i=>setHidden(h=>{const n=new Set(h);n.has(i)?n.delete(i):n.add(i);return n;})} format={format} total={allTotal}/>
  {node}</div>;
}
