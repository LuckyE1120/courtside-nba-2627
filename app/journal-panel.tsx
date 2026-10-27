'use client';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Camera, Check, Download, ImagePlus, Sparkles, Upload, X } from 'lucide-react';
import type { Game } from '../lib/nba';
import { MOODS, dateInChina, gamesInPeriod, periodBounds, watchedFromGame, type DiaryPeriod, type JournalData, type Mood, type WatchedGame } from '../lib/journal';
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_GAME } from '../lib/photo';
import { deletePhoto, downloadPhoto, uploadPhoto } from '../lib/journal-cloud';

type Props = { date:string; games:Game[]; openGameId?:string|null; onOpenedGame?:()=>void; data:JournalData; canUpload:boolean; onSave:(record:WatchedGame)=>Promise<void>; onRemove:(record:WatchedGame)=>Promise<void>; onFrequency:(frequency:DiaryPeriod)=>void; onImport:(file:File)=>void; onGenerate:(period:DiaryPeriod,from:string,to:string)=>void; generating:boolean; aiReady:boolean };
type PendingPhoto = { file:File; url:string };
const moodEmoji:Record<Mood,string> = { 激动:'🤩', 开心:'😄', 紧张:'😬', 平静:'😌', 失落:'😔', 热血:'🔥' };
const presets = ['这场看得真过瘾！','最后几分钟太紧张了。','今天的心情被比赛点亮。','赢球的快乐想记下来。','虽然失落，还是会继续支持。','想和朋友再聊聊这场。'];

function PhotoThumb({ id, alt }: { id: string; alt: string }) {
 const [url,setUrl]=useState('');
 useEffect(()=>{let active=true;let objectUrl='';downloadPhoto(id).then(blob=>{objectUrl=URL.createObjectURL(blob);if(active)setUrl(objectUrl);else URL.revokeObjectURL(objectUrl)}).catch(()=>{});return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)}},[id]);
 return url?<img src={url} alt={alt}/>:<span className="journal-photo-loading" role="img" aria-label="图片加载中"><Camera size={16}/></span>;
}

export default function JournalPanel({date,games,openGameId,onOpenedGame,data,canUpload,onSave,onRemove,onFrequency,onImport,onGenerate,generating,aiReady}:Props){
 const [periodDate,setPeriodDate]=useState(date||new Date().toISOString().slice(0,10));
 const [original,setOriginal]=useState<WatchedGame|null>(null);
 const [draft,setDraft]=useState<WatchedGame|null>(null);
 const [pending,setPending]=useState<PendingPhoto[]>([]);
 const [editorError,setEditorError]=useState('');
 const [recordQuery,setRecordQuery]=useState('');
 const [saving,setSaving]=useState(false);
 const dialogRef=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(date)setPeriodDate(date)},[date]);
 useEffect(()=>{if(!openGameId)return;const game=games.find(item=>item.id===openGameId);if(game){openGame(game);onOpenedGame?.()}},[openGameId,games,onOpenedGame]);
 useEffect(()=>{if(draft&&!dialogRef.current?.open)dialogRef.current?.showModal();if(!draft&&dialogRef.current?.open)dialogRef.current.close()},[draft]);
 const bounds=periodBounds(periodDate,data.frequency);
 const selected=gamesInPeriod(data.watched,bounds.from,bounds.to);
 const visibleRecords=data.watched.filter(record=>`${record.away} ${record.home} ${record.note} ${record.mood||''} ${dateInChina(record.date)}`.toLowerCase().includes(recordQuery.trim().toLowerCase()));
 const diary=data.diaries.find(item=>item.period===data.frequency&&item.from===bounds.from&&item.to===bounds.to);
 function openGame(game:Game){const found=data.watched.find(item=>item.gameId===game.id)||null;openRecord(found,found?null:game)}
 function openRecord(found:WatchedGame|null,game:Game|null){setOriginal(found);setDraft(found?{...found,photos:[...(found.photos||[])]}:game?watchedFromGame(game):null);setPending([]);setEditorError('')}
 function closeEditor(){if(saving)return;pending.forEach(photo=>URL.revokeObjectURL(photo.url));setPending([]);setDraft(null);setOriginal(null);setEditorError('')}
 function addFiles(files:FileList|null){if(!files||!draft)return;const picked=Array.from(files);if((draft.photos?.length||0)+pending.length+picked.length>MAX_PHOTOS_PER_GAME){setEditorError(`每场最多上传 ${MAX_PHOTOS_PER_GAME} 张图片。`);return}if(picked.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type))){setEditorError('只支持 JPG、PNG 或 WebP 图片。');return}if(picked.some(file=>file.size>MAX_PHOTO_BYTES)){setEditorError('单张图片不能超过 2 MB。');return}setPending(current=>[...current,...picked.map(file=>({file,url:URL.createObjectURL(file)}))]);setEditorError('')}
 async function saveEditor(){if(!draft)return;setSaving(true);setEditorError('');const uploaded:string[]=[];try{for(const photo of pending)uploaded.push(await uploadPhoto(photo.file));const record={...draft,photos:[...(draft.photos||[]),...uploaded],updatedAt:new Date().toISOString()};await onSave(record);const removed=(original?.photos||[]).filter(id=>!record.photos.includes(id));await Promise.allSettled(removed.map(deletePhoto));pending.forEach(photo=>URL.revokeObjectURL(photo.url));setPending([]);setDraft(null);setOriginal(null)}catch(error){await Promise.allSettled(uploaded.map(deletePhoto));setEditorError(error instanceof Error?error.message:'保存失败，请重试')}finally{setSaving(false)}}
 async function removeEditor(){if(!original||saving||!window.confirm('取消圈选这场比赛并删除这场的观赛记录与图片？'))return;setSaving(true);setEditorError('');try{await onRemove(original);pending.forEach(photo=>URL.revokeObjectURL(photo.url));setPending([]);setDraft(null);setOriginal(null)}catch(error){setEditorError(error instanceof Error?error.message:'取消圈选失败')}finally{setSaving(false)}}
 function exportJournal(){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='courtside-观赛日记备份.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
 return <section className="journal-page">
  <div className="journal-intro"><div className="eyebrow"><span/> YOUR GAME DIARY</div><h2>把看过的比赛，写成自己的故事。</h2><p>点击一场比赛，选个心情、写下片刻感受，再加上观赛照片。保存后记录与图片会同步到你的账号。</p></div>
  <div className="journal-layout"><div>
   <section className="journal-card"><div className="journal-card-head"><div><h3>这一天看了哪些比赛？</h3><p>当前选中 {date} · 点击比赛，打开观赛记录</p></div><b>{games.filter(game=>data.watched.some(record=>record.gameId===game.id)).length}/{games.length}</b></div>
    {games.length?<div className="watched-picker">{games.map(game=>{const record=data.watched.find(item=>item.gameId===game.id);return <button key={game.id} type="button" aria-label={`${record?'编辑':'记录'}${game.teams[0].name}对${game.teams[1].name}的观赛感受`} className={record?'is-watched':''} onClick={()=>openGame(game)}><span className="watched-check">{record?<Check size={14}/>:<span>＋</span>}</span><span>{game.teams[0].name} <em>{game.complete?`${game.teams[0].score??'—'} : ${game.teams[1].score??'—'}`:'vs'}</em> {game.teams[1].name}<small>{new Date(game.date).toLocaleTimeString('zh-CN',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false})} · {game.complete?'已结束':game.state==='in'?'进行中':'未开赛'}{record?.mood?` · ${moodEmoji[record.mood]} ${record.mood}`:''}</small></span></button>})}</div>:<p className="journal-empty">这一天暂无已公布场次，可以切换上方日期。</p>}
   </section>
   <section className="journal-card"><div className="journal-card-head"><div><h3>我的观赛记录</h3><p>共圈选 {data.watched.length} 场 · 点击记录可继续编辑</p></div><div className="journal-actions"><label className="journal-export"><Upload size={14}/>导入<input type="file" accept="application/json,.json" hidden onChange={event=>{const file=event.target.files?.[0];if(file)onImport(file);event.target.value=''}}/></label><button className="journal-export" onClick={exportJournal}><Download size={14}/>备份</button></div></div>
    {data.watched.length>0&&<input className="journal-record-search" type="search" aria-label="搜索观赛记录" placeholder="搜索球队、日期、心情或笔记" value={recordQuery} onChange={event=>setRecordQuery(event.target.value)}/>}
    {visibleRecords.length?<div className="journal-records">{[...visibleRecords].sort((a,b)=>b.date.localeCompare(a.date)).map(record=><article key={record.gameId}><div className="journal-record-title"><time>{dateInChina(record.date)}</time><strong>{record.away} <em>{record.awayScore!==null&&record.homeScore!==null?`${record.awayScore} : ${record.homeScore}`:'vs'}</em> {record.home}</strong></div><div className="journal-record-summary">{record.mood&&<span>{moodEmoji[record.mood]} {record.mood}</span>}{record.note&&<p>{record.note}</p>}{!!record.photos?.length&&<div className="journal-thumbnails">{record.photos.map(id=><PhotoThumb key={id} id={id} alt="观赛记录图片"/>)}</div>}{!record.mood&&!record.note&&!record.photos?.length&&<span>还没有填写感受</span>}</div><button className="journal-edit" onClick={()=>openRecord(record,null)}>编辑记录 →</button></article>)}</div>:<p className="journal-empty">{data.watched.length?'没有找到匹配的观赛记录。':'还没有观赛记录。先在上方选择一场比赛吧。'}</p>}
    <small className="journal-backup-hint">备份文件包含文字和图片引用；原图保存在登录账号的云端。</small>
   </section>
  </div><aside className="journal-card diary-card"><div className="diary-kicker"><Sparkles size={18}/> 观赛日记</div><h3>让每一段观赛记忆，有迹可循。</h3><p>选择周记或月记，把圈选比赛与真实心情整理成一篇日记。</p><div className="frequency-pills"><button className={data.frequency==='week'?'active':''} onClick={()=>onFrequency('week')}>每周</button><button className={data.frequency==='month'?'active':''} onClick={()=>onFrequency('month')}>每月</button></div><label className="period-field">查看周期<input type="date" value={periodDate} min="2026-10-01" max="2027-06-30" onChange={event=>setPeriodDate(event.target.value)}/></label><div className="diary-range">{bounds.from} — {bounds.to}<strong>{selected.length} 场已观看</strong></div>
    {diary?<article className="diary-content"><div><BookOpen size={16}/> {diary.source==='ai'?'AI 观赛日记':'观赛日记草稿'}</div><p>{diary.text}</p><small>生成于 {new Date(diary.createdAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}</small></article>:<p className="diary-placeholder">这个周期还没有生成日记。</p>}
    <button className="diary-generate" disabled={!selected.length||generating||!aiReady} onClick={()=>{if(!diary||window.confirm('重新生成会覆盖当前日记。建议先复制保留原文，确定继续吗？'))onGenerate(data.frequency,bounds.from,bounds.to)}}><Sparkles size={15}/>{generating?'正在生成…':diary?'重新生成 AI 日记':'生成 AI 日记'}</button><small className="diary-help">{!selected.length?'先圈选至少一场比赛。':!aiReady?'DeepSeek 尚未配置；观赛记录仍可正常使用。':'只会把这个周期圈选的比赛、心情与文字发送给 DeepSeek；图片不会发送。自动生成在周期结束后每天北京时间 10:00 检查。'}</small>
   </aside></div>
   <dialog ref={dialogRef} className="journal-dialog" onCancel={event=>{event.preventDefault();closeEditor()}} onClick={event=>{if(event.target===event.currentTarget)closeEditor()}}>
    {draft&&<div className="journal-dialog-body"><button className="journal-dialog-close" aria-label="关闭记录弹窗" onClick={closeEditor} disabled={saving}><X size={19}/></button><div className="journal-dialog-kicker">COURTSIDE MEMORY · 观赛时刻</div><h2>{draft.away} <span>vs</span> {draft.home}</h2><p className="journal-dialog-sub">{dateInChina(draft.date)} · {draft.awayScore!==null&&draft.homeScore!==null?`${draft.awayScore} : ${draft.homeScore}`:'把这场留在日记里'}</p>
     <div className="journal-form-section"><h3>此刻的心情 <small>选一个最贴近你的表情</small></h3><div className="journal-moods">{MOODS.map(mood=><button key={mood} type="button" aria-pressed={draft.mood===mood} onClick={()=>setDraft(current=>current&&({...current,mood}))}><span>{moodEmoji[mood]}</span>{mood}</button>)}</div></div>
     <div className="journal-form-section"><h3>写下这场比赛 <small>点一句灵感，也可以自由写</small></h3><div className="journal-presets">{presets.map(line=><button type="button" key={line} onClick={()=>setDraft(current=>current&&({...current,note:[current.note.trim(),line].filter(Boolean).join('\n').slice(0,1000)}))}>{line}</button>)}</div><textarea aria-label="我的观赛感受" placeholder="哪一个瞬间，让你想把这场比赛记下来？" maxLength={1000} value={draft.note} onChange={event=>setDraft(current=>current&&({...current,note:event.target.value}))}/><small className="journal-counter">{draft.note.length}/1000 字</small></div>
     <div className="journal-form-section"><h3>加入照片 <small>最多 3 张，每张不超过 2 MB</small></h3><div className="journal-photo-grid">{(draft.photos||[]).map(id=><div className="journal-photo" key={id}><PhotoThumb id={id} alt="已上传的观赛图片"/><button type="button" aria-label="移除图片" onClick={()=>setDraft(current=>current&&({...current,photos:(current.photos||[]).filter(photoId=>photoId!==id)}))}><X size={14}/></button></div>)}{pending.map(photo=><div className="journal-photo" key={photo.url}><img src={photo.url} alt="待上传的观赛图片"/><button type="button" aria-label="移除待上传图片" onClick={()=>{URL.revokeObjectURL(photo.url);setPending(current=>current.filter(item=>item!==photo))}}><X size={14}/></button></div>)}{canUpload&&(draft.photos?.length||0)+pending.length<MAX_PHOTOS_PER_GAME&&<label className="journal-add-photo"><ImagePlus size={21}/><span>添加图片</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={event=>{addFiles(event.target.files);event.target.value=''}}/></label>}</div>{!canUpload&&<p className="journal-photo-login"><Camera size={14}/> 登录后即可上传照片并在云端保存。</p>}</div>
     {editorError&&<p className="journal-editor-error" role="alert">{editorError}</p>}
     <div className="journal-dialog-actions">{original&&<button className="journal-unwatch" onClick={removeEditor} disabled={saving}>取消圈选</button>}<button className="journal-cancel" onClick={closeEditor} disabled={saving}>放弃未保存修改</button><button className="journal-save" onClick={saveEditor} disabled={saving}>{saving?'保存中…':original?'保存观赛记录':'圈选并保存'}</button></div>
    </div>}
   </dialog>
 </section>
}
