"use client";
import {useState} from 'react';
import {Item,palette,shade,niceTicks,compact,defaultFormat,useTooltip,useUid,pos,neg} from './core';
type Props={items:Item[];format?:(v:number|null)=>string;axisFormat?:(v:number)=>string;accent?:string;colorful?:boolean;signed?:boolean;compare?:(number|null)[];compareLabel?:string;total?:boolean;onSelect?:(it:Item,i:number)=>void;height?:number;label?:string;highlight?:number};
export default function Bar3D({items,format=defaultFormat,axisFormat=compact,accent=palette[0],colorful=false,signed=false,compare,compareLabel='Período anterior',total=false,onSelect,height=300,label='Gráfica de barras',highlight}:Props){
 const uid=useUid(),{ref,show,hide,node}=useTooltip(),[active,setActive]=useState<number|null>(null);
 const W=680,H=height,L=64,R=24,T=28,B=items.length>7?(Math.max(...items.map(i=>Math.min(i.label.length,18)))*5.2+30):52,depth=items.length>18?4:9;
 const vals=items.map(i=>i.value??0),min=Math.min(0,...vals),max=Math.max(0,...vals),ticks=niceTicks(min,max,4),lo=ticks[0],hi=ticks.at(-1)!;
 const y=(v:number)=>T+(hi-v)/(hi-lo||1)*(H-T-B),y0=y(0),slot=(W-L-R-depth)/Math.max(1,items.length),bw=Math.min(64,Math.max(5,slot*.58));
 const sum=vals.reduce((a,b)=>a+Math.max(0,b),0);
 if(!items.length)return <p className="c3-empty">Sin datos para este rango.</p>;
 return <div className="c3-wrap" ref={ref} onMouseLeave={()=>{hide();setActive(null);}}>
 <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="c3-svg">
  <defs>{items.map((it,i)=>{const c=it.color??(signed?((it.value??0)<0?neg:pos):colorful?palette[i%palette.length]:accent);return <linearGradient key={i} id={`${uid}-g${i}`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor={shade(c,.28)}/><stop offset=".55" stopColor={c}/><stop offset="1" stopColor={shade(c,-.12)}/></linearGradient>;})}
  <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--c3-floor)" stopOpacity=".9"/><stop offset="1" stopColor="var(--c3-floor)" stopOpacity="0"/></linearGradient></defs>
  <path d={`M${L} ${y0}H${W-R-depth}l${depth} ${-depth*.6}H${L+depth}Z`} fill="var(--c3-floor)" opacity=".55"/>
  {ticks.map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} className={t===0?'c3-zero':'c3-grid'}/><text x={L-10} y={y(t)+4} textAnchor="end" className="c3-axis">{axisFormat(t)}</text></g>)}
  {items.map((it,i)=>{const v=it.value??0,x=L+i*slot+(slot-bw)/2,top=y(Math.max(v,0)),bot=y(Math.min(v,0)),h=Math.max(1,bot-top),c=it.color??(signed?(v<0?neg:pos):colorful?palette[i%palette.length]:accent),on=active===i||highlight===i;
   const prev=compare?.[i],varPct=prev!=null&&prev!==0&&it.value!=null?(it.value-prev)/Math.abs(prev)*100:null;
   const lines:[string,string,string?][]=[['Valor',format(it.value)]];if(total&&sum)lines.push(['Participación',`${(Math.max(0,v)/sum*100).toLocaleString('es-PA',{maximumFractionDigits:1})} %`]);if(prev!=null)lines.push([compareLabel,format(prev)]);if(varPct!=null)lines.push(['Variación',`${varPct>0?'▲ +':'▼ '}${varPct.toLocaleString('es-PA',{maximumFractionDigits:1})} %`,varPct>=0?pos:neg]);if(it.note)lines.push(['',it.note]);
   const enter=(e:any)=>{setActive(i);show(e,e.currentTarget,it.label,lines);};
   return <g key={it.key??it.label+i} className={`c3-bar${on?' on':''}${onSelect?' click':''}`} style={{animationDelay:`${Math.min(i,24)*35}ms`,transformOrigin:`${x+bw/2}px ${y0}px`}} tabIndex={0} role="button" aria-label={`${it.label}: ${format(it.value)}`} onMouseMove={enter} onFocus={enter} onBlur={hide} onClick={()=>onSelect?.(it,i)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(it,i);}}}>
    <ellipse cx={x+bw/2+depth} cy={y0+3} rx={bw*.75} ry={4} fill="#0b2233" opacity=".10"/>
    <path d={`M${x+bw} ${top}l${depth} ${-depth*.6}V${bot-depth*.6}l${-depth} ${depth*.6}Z`} fill={shade(c,-.35)}/>
    <path d={`M${x} ${top}l${depth} ${-depth*.6}h${bw}l${-depth} ${depth*.6}Z`} fill={shade(c,.42)}/>
    <rect x={x} y={top} width={bw} height={h} fill={`url(#${uid}-g${i})`}/>
    <rect x={x+bw*.12} y={top+2} width={Math.max(1,bw*.12)} height={Math.max(0,h-4)} fill="#fff" opacity=".18"/>
    {items.length<=10&&<text x={x+bw/2+depth/2} y={v<0?bot+15:top-depth*.6-7} textAnchor="middle" className="c3-val" fontSize={items.length>8?9.5:11.5}>{axisFormat(v)}</text>}
    <text x={x+bw/2} y={H-B+18} textAnchor={items.length>7?'end':'middle'} transform={items.length>7?`rotate(-32 ${x+bw/2} ${H-B+18})`:undefined} className="c3-label">{items.length>7&&it.label.length>18?it.label.slice(0,17)+'…':it.label.length>26?it.label.slice(0,25)+'…':it.label}</text>
   </g>;})}
 </svg>{node}</div>;
}
