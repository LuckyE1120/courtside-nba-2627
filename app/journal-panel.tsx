'use client';
import {useEffect,useState} from 'react';
import {BookOpen,Check,Download,Upload,Sparkles} from 'lucide-react';
import type {Game} from '../lib/nba';
import {MOODS,dateInChina,gamesInPeriod,periodBounds,type DiaryPeriod,type JournalData,type Mood,type WatchedGame} from '../lib/journal';

type Props={date:string;games:Game[];data:JournalData;onToggle:(game:Game)=>void;onRecord:(gameId:string,patch:Partial<WatchedGame>)=>void;onFrequency:(frequency:DiaryPeriod)=>void;onImport:(file:File)=>void;onGenerate:(period:DiaryPeriod,from:string,to:string)=>void;generating:boolean;aiReady:boolean};

export default function JournalPanel({date,games,data,onToggle,onRecord,onFrequency,onImport,onGenerate,generating,aiReady}:Props){
 const [periodDate,setPeriodDate]=useState(date||new Date().toISOString().slice(0,10));
 useEffect(()=>{if(date)setPeriodDate(date)},[date]);
 const bounds=periodBounds(periodDate,data.frequency);
 const selected=gamesInPeriod(data.watched,bounds.from,bounds.to);
 const diary=data.diaries.find(item=>item.period===data.frequency&&item.from===bounds.from&&item.to===bounds.to);
 const exportJournal=()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='courtside-观赛日记备份.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return <section className="journal-page">
  <div className="journal-intro"><div className="eyebrow"><span/> YOUR GAME DIARY</div><h2>把看过的比赛，写成自己的故事。</h2><p>圈选看过的场次，记下心情和想说的话。登录后记录会同步到云端；未登录时仍保存在当前浏览器，可随时下载备份。</p></div>
  <div className="journal-layout"><div>
   <section className="journal-card"><div className="journal-card-head"><div><h3>这一天看了哪些比赛？</h3><p>当前选中 {date} · 点击比赛即可标记</p></div><b>{games.filter(g=>data.watched.some(w=>w.gameId===g.id)).length}/{games.length}</b></div>
    {games.length?<div className="watched-picker">{games.map(game=>{const checked=data.watched.some(w=>w.gameId===game.id);return <button key={game.id} type="button" aria-pressed={checked} className={checked?'is-watched':''} onClick={()=>onToggle(game)}><span className="watched-check">{checked&&<Check size={14}/>}</span><span>{game.teams[0].name} <em>{game.complete?`${game.teams[0].score??'—'} : ${game.teams[1].score??'—'}`:'vs'}</em> {game.teams[1].name}<small>{new Date(game.date).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false})} · {game.complete?'已结束':game.state==='in'?'进行中':'未开赛'}</small></span></button>})}</div>:<p className="journal-empty">这一天暂无已公布场次，可以切换上方日期。</p>}
   </section>
   <section className="journal-card"><div className="journal-card-head"><div><h3>我的观赛记录</h3><p>共圈选 {data.watched.length} 场，按最近观看时间排列</p></div><div className="journal-actions"><label className="journal-export"><Upload size={14}/>导入<input type="file" accept="application/json,.json" hidden onChange={event=>{const file=event.target.files?.[0];if(file)onImport(file);event.target.value=''}}/></label><button className="journal-export" onClick={exportJournal}><Download size={14}/>备份</button></div></div>
    {data.watched.length?<div className="journal-records">{[...data.watched].sort((a,b)=>b.date.localeCompare(a.date)).map(record=><article key={record.gameId}><div className="journal-record-title"><time>{dateInChina(record.date)}</time><strong>{record.away} <em>{record.awayScore!==null&&record.homeScore!==null?`${record.awayScore} : ${record.homeScore}`:'vs'}</em> {record.home}</strong></div><div className="mood-picker" aria-label={`${record.away}对${record.home}的观赛心情`}>{MOODS.map(mood=><button key={mood} type="button" aria-pressed={record.mood===mood} onClick={()=>onRecord(record.gameId,{mood:mood as Mood})}>{mood}</button>)}</div><textarea aria-label={`记录${record.away}对${record.home}的观赛感受`} placeholder="这场比赛让你记住了什么？" maxLength={1000} value={record.note} onChange={event=>onRecord(record.gameId,{note:event.target.value})}/><small>{record.note.length}/1000 字 · 自动保存</small></article>)}</div>:<p className="journal-empty">还没有观赛记录。先在上方圈选一场比赛吧。</p>}
   </section>
  </div><aside className="journal-card diary-card"><div className="diary-kicker"><Sparkles size={18}/> 观赛日记</div><h3>让每一段观赛记忆，有迹可循。</h3><p>选择周记或月记，把圈选比赛与真实心情整理成一篇日记。</p><div className="frequency-pills"><button className={data.frequency==='week'?'active':''} onClick={()=>onFrequency('week')}>每周</button><button className={data.frequency==='month'?'active':''} onClick={()=>onFrequency('month')}>每月</button></div><label className="period-field">查看周期<input type="date" value={periodDate} min="2026-10-01" max="2027-06-30" onChange={event=>setPeriodDate(event.target.value)}/></label><div className="diary-range">{bounds.from} — {bounds.to}<strong>{selected.length} 场已观看</strong></div>
    {diary?<article className="diary-content"><div><BookOpen size={16}/> {diary.source==='ai'?'AI 观赛日记':'观赛日记草稿'}</div><p>{diary.text}</p><small>生成于 {new Date(diary.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small></article>:<p className="diary-placeholder">这个周期还没有生成日记。</p>}
    <button className="diary-generate" disabled={!selected.length||generating||!aiReady} onClick={()=>onGenerate(data.frequency,bounds.from,bounds.to)}><Sparkles size={15}/>{generating?'正在生成…':diary?'重新生成 AI 日记':'生成 AI 日记'}</button><small className="diary-help">{!selected.length?'先圈选至少一场比赛。':!aiReady?'DeepSeek 尚未配置；观赛记录仍可正常使用。':'只会把这个周期圈选的比赛与笔记发送给 DeepSeek。'}</small>
   </aside></div>
 </section>;
}
