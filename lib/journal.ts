import type {Game} from './nba';

export type Mood='激动'|'开心'|'紧张'|'平静'|'失落';
export type WatchedGame={gameId:string;date:string;away:string;home:string;awayScore:number|null;homeScore:number|null;mood:Mood|null;note:string;updatedAt:string};
export type DiaryPeriod='week'|'month';
export type Diary={id:string;period:DiaryPeriod;from:string;to:string;text:string;gameIds:string[];createdAt:string;source:'ai'|'draft'};
export type JournalData={version:1;watched:WatchedGame[];diaries:Diary[];frequency:DiaryPeriod};
export const JOURNAL_KEY='courtside-journal-v1';
export const EMPTY_JOURNAL:JournalData={version:1,watched:[],diaries:[],frequency:'week'};
export const MOODS:Mood[]=['激动','开心','紧张','平静','失落'];

export function readJournal():JournalData{
 try{const raw=JSON.parse(localStorage.getItem(JOURNAL_KEY)||'null');if(raw?.version===1&&Array.isArray(raw.watched)&&Array.isArray(raw.diaries))return {...EMPTY_JOURNAL,...raw,frequency:raw.frequency==='month'?'month':'week'};}catch{}
 return {...EMPTY_JOURNAL};
}
export function saveJournal(data:JournalData){localStorage.setItem(JOURNAL_KEY,JSON.stringify(data));}
export function watchedFromGame(game:Game):WatchedGame{return {gameId:game.id,date:game.date,away:game.teams[0].name,home:game.teams[1].name,awayScore:game.teams[0].score,homeScore:game.teams[1].score,mood:null,note:'',updatedAt:new Date().toISOString()};}
export function periodBounds(date:string,period:DiaryPeriod):{from:string;to:string}{
 const d=new Date(date+'T12:00:00Z');
 if(period==='week'){const weekday=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-weekday);const from=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return {from,to:d.toISOString().slice(0,10)};}
 const from=date.slice(0,7)+'-01';d.setUTCMonth(d.getUTCMonth()+1,0);return {from,to:d.toISOString().slice(0,10)};
}
export function dateInChina(iso:string){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
export function gamesInPeriod(records:WatchedGame[],from:string,to:string){return records.filter(record=>{const date=dateInChina(record.date);return date>=from&&date<=to}).sort((a,b)=>a.date.localeCompare(b.date));}
export function diaryPrompt(records:WatchedGame[],from:string,to:string):string{
 const lines=records.map(record=>{const score=record.awayScore!==null&&record.homeScore!==null?`${record.awayScore}:${record.homeScore}`:'比分未记录';return `- ${dateInChina(record.date)} ${record.away} vs ${record.home}，${score}；心情：${record.mood||'未填写'}；我的感受：${record.note.trim()||'未填写'}`});
 return `请根据以下真实观赛记录，写一篇中文第一人称 NBA 观赛日记，时间范围 ${from} 至 ${to}。控制在 250 至 400 字。只使用记录里的事实和用户写下的感受，不要虚构比赛过程、球员表现或用户经历；心情未填写时不要推断。先给一个自然的标题，再写两到三段正文。\n\n${lines.join('\n')}`;
}
