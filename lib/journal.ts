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
 const hasNotes=records.some(record=>record.note.trim());
 return `请根据以下真实观赛记录，写一篇中文第一人称 NBA 观赛日记，时间范围 ${from} 至 ${to}。${hasNotes?'约 200 至 350 字':'约 80 至 150 字；素材很少时宁可更短'}。只写已记录的比赛、比分、心情和本人感受；没有记录的细节一律省略。不要推测赛况、气氛、观赛体验或其他日期发生了什么，不要用“应该”“想必”等猜测语气，也不要反复解释哪些字段没有填写。第一行写简短标题，后面写一到两段正文；输出纯文本，不使用 Markdown 标记。\n\n${lines.join('\n')}`;
}

export function duePeriod(today:string,frequency:DiaryPeriod):{from:string;to:string}|null{
 const current=periodBounds(today,frequency);
 const dayBeforeCurrent=new Date(current.from+'T12:00:00Z');
 dayBeforeCurrent.setUTCDate(dayBeforeCurrent.getUTCDate()-1);
 return periodBounds(dayBeforeCurrent.toISOString().slice(0,10),frequency);
}
