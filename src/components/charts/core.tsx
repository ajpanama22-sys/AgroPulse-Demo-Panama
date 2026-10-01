"use client";
import {useId,useRef,useState,useCallback} from 'react';
export type Item={label:string;value:number|null;color?:string;key?:string;note?:string};
export const palette=['#14a3a0','#c9962b','#3f6fd1','#8f6cc9','#e0794f','#4fa36b','#d4558a','#5b8aa8','#b7a13a','#2f8fc2'];
export const pos='#2e9e6a',neg='#d0544f',warn='#d9952b';
export const defaultFormat=(v:number|null)=>v==null||Number.isNaN(v)?'N/D':Number(v).toLocaleString('es-PA',{maximumFractionDigits:2,useGrouping:'always' as any});
// Aclara u oscurece un color hex para las caras del relieve.
export function shade(hex:string,amt:number){const h=hex.replace('#','');const n=parseInt(h.length===3?h.split('').map(c=>c+c).join(''):h,16);let r=n>>16,g=(n>>8)&255,b=n&255;const f=(c:number)=>Math.max(0,Math.min(255,Math.round(amt<0?c*(1+amt):c+(255-c)*amt)));r=f(r);g=f(g);b=f(b);return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1);}
export function niceTicks(min:number,max:number,count=4){if(min===max){max=min+1;}const span=max-min,step0=span/count,mag=Math.pow(10,Math.floor(Math.log10(step0))),err=step0/mag,step=(err>=7.5?10:err>=3.5?5:err>=1.5?2:1)*mag;const lo=Math.floor(min/step)*step,hi=Math.ceil(max/step)*step,out=[];for(let v=lo;v<=hi+step/2;v+=step)out.push(Number(v.toPrecision(12)));return out;}
export function compact(v:number){const a=Math.abs(v);if(a>=1e9)return (v/1e9).toLocaleString('es-PA',{maximumFractionDigits:1})+' mil M';if(a>=1e6)return (v/1e6).toLocaleString('es-PA',{maximumFractionDigits:1})+' M';if(a>=1e4)return (v/1e3).toLocaleString('es-PA',{maximumFractionDigits:0})+' mil';return v.toLocaleString('es-PA',{maximumFractionDigits:a<10?2:0,useGrouping:'always' as any});}
export function useTooltip(){
 const ref=useRef<HTMLDivElement>(null),[tip,setTip]=useState<{x:number;y:number;title:string;lines:[string,string,string?][]}|null>(null);
 const show=useCallback((e:{clientX:number;clientY:number}|null,el:Element|null,title:string,lines:[string,string,string?][])=>{const box=ref.current?.getBoundingClientRect();if(!box)return;let x,y;if(e&&e.clientX){x=e.clientX-box.left;y=e.clientY-box.top;}else{const r=(el as Element).getBoundingClientRect();x=r.left+r.width/2-box.left;y=r.top-box.top;}setTip({x,y,title,lines});},[]);
 const hide=useCallback(()=>setTip(null),[]);
 const node=tip?<div className="c3-tip" role="status" style={{left:Math.min(Math.max(tip.x,90),(ref.current?.clientWidth??400)-90),top:tip.y}}><b>{tip.title}</b>{tip.lines.map(([k,v,c],i)=><span key={i}><em>{k}</em><strong style={c?{color:c}:undefined}>{v}</strong></span>)}</div>:null;
 return {ref,show,hide,node};
}
export const useUid=()=>useId().replace(/[:«»]/g,'');
export function Legend({items,hidden,onToggle,format,total}:{items:Item[];hidden?:Set<number>;onToggle?:(i:number)=>void;format?:(v:number|null)=>string;total?:number}){
 return <ul className="c3-legend">{items.map((it,i)=><li key={it.key??it.label}><button type="button" aria-pressed={!hidden?.has(i)} onClick={()=>onToggle?.(i)} className={hidden?.has(i)?'off':''}><i style={{background:it.color??palette[i%palette.length]}}/><span>{it.label}</span>{format&&<b>{format(it.value)}</b>}{total?<small>{((it.value??0)/total*100).toLocaleString('es-PA',{maximumFractionDigits:1})} %</small>:null}</button></li>)}</ul>;
}
export function ChartSwitch({value,onChange,options}:{value:string;onChange:(v:string)=>void;options:[string,string][]}){
 return <div className="c3-switch" role="radiogroup" aria-label="Tipo de gráfica">{options.map(([v,l])=><button type="button" role="radio" aria-checked={value===v} key={v} onClick={()=>onChange(v)}>{l}</button>)}</div>;
}
export function ChartCard({eyebrow,title,actions,children,footnote,wide,onOpen,openLabel}:{eyebrow?:string;title:string;actions?:React.ReactNode;children:React.ReactNode;footnote?:React.ReactNode;wide?:boolean;onOpen?:()=>void;openLabel?:string}){
 return <section className={`c3-card${wide?' wide':''}`}><div className="c3-head"><div>{eyebrow&&<p className="eyebrow">{eyebrow}</p>}<h3>{title}</h3></div><div className="c3-actions">{actions}{onOpen&&<button type="button" className="c3-open" onClick={onOpen}>{openLabel??'Explorar'} ↗</button>}</div></div>{children}{footnote&&<p className="c3-foot">{footnote}</p>}</section>;
}
