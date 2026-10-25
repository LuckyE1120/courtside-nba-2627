import {env} from 'cloudflare:workers';
import {and,eq,gte,lte} from 'drizzle-orm';
import {getDb} from '../db';
import {diaries,journalSettings,watchedGames} from '../db/schema';
import {dateInChina,diaryPrompt,gamesInPeriod,periodBounds,type DiaryPeriod,type JournalData,type WatchedGame} from './journal';

export async function loadJournal(userId:string):Promise<JournalData>{
 const db=getDb();
 const [records,writings,settings]=await Promise.all([
  db.select().from(watchedGames).where(eq(watchedGames.userId,userId)),
  db.select().from(diaries).where(eq(diaries.userId,userId)),
  db.select().from(journalSettings).where(eq(journalSettings.userId,userId)).limit(1),
 ]);
 return {version:1,watched:records.map(r=>({gameId:r.gameId,date:r.date,away:r.away,home:r.home,awayScore:r.awayScore,homeScore:r.homeScore,mood:r.mood as WatchedGame['mood'],note:r.note,updatedAt:r.updatedAt})),diaries:writings.map(d=>({id:d.id,period:d.period as DiaryPeriod,from:d.from,to:d.to,text:d.text,gameIds:JSON.parse(d.gameIds) as string[],createdAt:d.createdAt,source:d.source as 'ai'|'draft'})),frequency:settings[0]?.frequency==='month'?'month':'week'};
}
export async function saveWatched(userId:string,record:WatchedGame){
 const day=dateInChina(record.date);const db=getDb();
 await db.insert(watchedGames).values({id:`${userId}:${record.gameId}`,userId,gameId:record.gameId,date:record.date,day,away:record.away,home:record.home,awayScore:record.awayScore,homeScore:record.homeScore,mood:record.mood,note:record.note,updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:watchedGames.id,set:{date:record.date,day,away:record.away,home:record.home,awayScore:record.awayScore,homeScore:record.homeScore,mood:record.mood,note:record.note,updatedAt:new Date().toISOString()}});
}
export async function removeWatched(userId:string,gameId:string){await getDb().delete(watchedGames).where(and(eq(watchedGames.userId,userId),eq(watchedGames.gameId,gameId)))}
export async function saveFrequency(userId:string,frequency:DiaryPeriod){await getDb().insert(journalSettings).values({userId,frequency,autoEnabled:true,updatedAt:new Date().toISOString()}).onConflictDoUpdate({target:journalSettings.userId,set:{frequency,updatedAt:new Date().toISOString()}})}
export async function generateDiary(userId:string,period:DiaryPeriod,from:string,to:string,replace=false){
 const db=getDb();const existing=await db.select().from(diaries).where(and(eq(diaries.userId,userId),eq(diaries.period,period),eq(diaries.from,from))).limit(1);
 if(existing.length&&!replace)return {status:'exists',diary:existing[0]};
 const rows=await db.select().from(watchedGames).where(and(eq(watchedGames.userId,userId),gte(watchedGames.day,from),lte(watchedGames.day,to)));
 const records:WatchedGame[]=rows.map(r=>({gameId:r.gameId,date:r.date,away:r.away,home:r.home,awayScore:r.awayScore,homeScore:r.homeScore,mood:r.mood as WatchedGame['mood'],note:r.note,updatedAt:r.updatedAt}));
 const selected=gamesInPeriod(records,from,to);if(!selected.length)return {status:'empty'};
 if(!env.OPENAI_API_KEY)return {status:'missing_key'};
 const result=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${env.OPENAI_API_KEY}`},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-5-mini',instructions:'你是一名严谨的中文体育日记编辑。只根据输入中已记录的事实写作，不捏造比赛过程、球员表现或观众经历。',input:diaryPrompt(selected,from,to),max_output_tokens:1000})});
 if(!result.ok)throw new Error(`AI service returned ${result.status}`);
 const output=await result.json() as {output?:{content?:{type?:string;text?:string}[]}[]};
 const text=output.output?.flatMap(item=>item.content||[]).filter(item=>item.type==='output_text').map(item=>item.text||'').join('\n').trim();
 if(!text)throw new Error('AI service returned no text');
 const diary={id:`${userId}:${period}:${from}`,userId,period,from,to,text,gameIds:JSON.stringify(selected.map(r=>r.gameId)),createdAt:new Date().toISOString(),source:'ai'};
 await db.insert(diaries).values(diary).onConflictDoUpdate({target:diaries.id,set:{text:diary.text,gameIds:diary.gameIds,createdAt:diary.createdAt,source:'ai'}});
 return {status:'generated',diary};
}
export async function generateDueDiaries(userId:string,today:string){
 const settings=await getDb().select().from(journalSettings).where(eq(journalSettings.userId,userId)).limit(1);
 if(settings[0]&&!settings[0].autoEnabled)return {status:'disabled'};
 const period=settings[0].frequency==='month'?'month':'week';
 const yesterday=new Date(today+'T12:00:00Z');yesterday.setUTCDate(yesterday.getUTCDate()-1);
 const anchor=yesterday.toISOString().slice(0,10);const {from,to}=periodBounds(anchor,period);
 if(to>=today)return {status:'not_due'};
 return generateDiary(userId,period,from,to,false);
}
