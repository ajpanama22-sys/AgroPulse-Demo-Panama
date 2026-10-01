"use client";
import {useUid,shade,palette,pos,neg} from './core';
export function Sparkline({values,color=palette[0]}:{values:(number|null)[];color?:string}){
 const uid=useUid(),v=values.map(x=>x??NaN).filter(x=>!Number.isNaN(x));if(v.length<2)return null;
 const min=Math.min(...v),max=Math.max(...v),W=120,H=36,x=(i:number)=>i*(W/(v.length-1)),y=(n:number)=>H-4-(n-min)/(max-min||1)*(H-8);
 const d=v.map((n,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(n).toFixed(1)).join('');
 return <svg viewBox={`0 0 ${W} ${H}`} className="c3-spark" aria-hidden="true"><defs><linearGradient id={`${uid}-s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".35"/><stop offset="1" stopColor={color} stopOpacity="0"/></linearGradient></defs><path d={`${d}L${W} ${H}L0 ${H}Z`} fill={`url(#${uid}-s)`}/><path d={d} fill="none" stroke={shade(color,-.1)} strokeWidth="2" strokeLinecap="round"/><circle cx={x(v.length-1)} cy={y(v.at(-1)!)} r="3" fill={color} stroke="#fff"/></svg>;
}
export function KpiTile({title,value,delta,deltaLabel='vs. mes anterior',good='up',spark,accent,note,onClick}:{title:string;value:string;delta?:number|null;deltaLabel?:string;good?:'up'|'down'|'none';spark?:(number|null)[];accent?:string;note?:string;onClick?:()=>void}){
 const better=delta==null||good==='none'?null:good==='up'?delta>=0:delta<=0;
 const Tag:any=onClick?'button':'div';
 return <Tag className="c3-kpi" onClick={onClick} type={onClick?'button':undefined}><span className="c3-kpiTitle">{title}</span><strong>{value}</strong>
  <div className="c3-kpiFoot">{delta!=null&&<em style={{color:better==null?'var(--muted)':better?pos:neg}}>{delta>=0?'▲':'▼'} {Math.abs(delta).toLocaleString('es-PA',{maximumFractionDigits:1})} %<small> {deltaLabel}</small></em>}{note&&<small className="c3-note">{note}</small>}</div>
  {spark&&<Sparkline values={spark} color={accent}/>}{onClick&&<i className="c3-go">Explorar ↗</i>}</Tag>;
}
