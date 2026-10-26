export const TEAMS: Record<string,string> = {ATL:'老鹰',BOS:'凯尔特人',BKN:'篮网',CHA:'黄蜂',CHI:'公牛',CLE:'骑士',DAL:'独行侠',DEN:'掘金',DET:'活塞',GS:'勇士',GSW:'勇士',HOU:'火箭',IND:'步行者',LAC:'快船',LAL:'湖人',MEM:'灰熊',MIA:'热火',MIL:'雄鹿',MIN:'森林狼',NO:'鹈鹕',NOP:'鹈鹕',NY:'尼克斯',NYK:'尼克斯',OKC:'雷霆',ORL:'魔术',PHI:'76人',PHX:'太阳',POR:'开拓者',SAC:'国王',SA:'马刺',SAS:'马刺',TOR:'猛龙',UTAH:'爵士',UTA:'爵士',WSH:'奇才',WAS:'奇才'};
export const teamOptions = ['ATL','BOS','BKN','CHA','CHI','CLE','DAL','DEN','DET','GS','HOU','IND','LAC','LAL','MEM','MIA','MIL','MIN','NO','NY','OKC','ORL','PHI','PHX','POR','SAC','SA','TOR','UTAH','WSH'];
export type Team={id:string;abbr:string;name:string;english:string;logo:string;color:string;score:number|null;home:boolean;record:string;quarters:number[];leaders:{name:string;value:number;player:string;image:string}[]};
export type Game={id:string;date:string;state:string;status:string;period:number;clock:string;venue:string;seasonType:number;teams:Team[];link:string;complete:boolean};
export type Day={date:string;games:Game[];updatedAt:string;error?:string;partial?:boolean;source?:'live'|'partial'|'snapshot'};
export function chinaDate(d=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(d)}
export function shiftDate(d:string,n:number){return new Date(new Date(d+'T12:00:00Z').getTime()+n*86400000).toISOString().slice(0,10)}
export const MIN_DATE='2026-10-01', MAX_DATE='2027-06-30';
export function validDate(d:string){return /^\d{4}-\d{2}-\d{2}$/.test(d)&&d>=MIN_DATE&&d<=MAX_DATE&&!isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d}
export function recap(g:Game){const [a,b]=g.teams;if(!a||!b)return '';if(!g.complete)return g.state==='in'?`${a.name}与${b.name}正在比赛，比分与统计将持续更新。`:`${a.name}客场挑战${b.name}，等待比赛开始。`;if(a.score===null||b.score===null)return '比赛已结束，等待比分更新。';const w=a.score>b.score?a:b,l=w===a?b:a;const margin=w.score!-l.score!;const scorers=[...a.leaders,...b.leaders].filter(x=>x.name==='points').sort((x,y)=>y.value-x.value);const player=scorers[0];const tied=player?scorers.filter(x=>x.value===player.value):[];return `${w.name}以 ${w.score}–${l.score} ${margin<=5?'险胜':'击败'}${l.name}${g.period>4?'，比赛经历加时':''}。${player?`${tied.map(p=>p.player).join(" 与 ")}${tied.length>1?"各":""}拿下 ${player.value} 分，${tied.length>1?"并列":""}领跑本场得分。`:''}`}
type SeasonSnapshot={generatedAt:string;games:Game[]};
let snapshotPromise:Promise<SeasonSnapshot>|null=null;
async function getSnapshot():Promise<SeasonSnapshot>{
 if(!snapshotPromise)snapshotPromise=fetch('/season-2026-27.json').then(async r=>{if(!r.ok)throw new Error('赛季快照不可用');const d=await r.json() as SeasonSnapshot;if(!Array.isArray(d.games))throw new Error('赛季快照格式异常');return d}).catch(e=>{snapshotPromise=null;throw e});
 return snapshotPromise;
}
export async function getSnapshotDay(date:string):Promise<Day|null>{
 try{const snapshot=await getSnapshot();return {date,games:snapshot.games.filter(g=>chinaDate(new Date(g.date))===date).map(g=>({...g,teams:g.teams.map(t=>({...t,name:TEAMS[t.abbr]||t.english}))})),updatedAt:snapshot.generatedAt,source:'snapshot',partial:true}}catch{return null}
}
export async function getDay(date:string):Promise<Day>{
 const [snapshotResult,...results]=await Promise.all([getSnapshot().then(value=>({value})).catch(()=>({value:null})),...([shiftDate(date,-1),date].map(async d=>{try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${d.replaceAll('-','')}&limit=20`,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error('upstream');const data=await r.json() as {events?:any[]};if(!Array.isArray(data.events))throw new Error('shape');return {events:data.events,ok:true}}catch{return {events:[] as any[],ok:false}}}))]);
 const snapshot=snapshotResult.value as SeasonSnapshot|null;
 const gamesById=new Map<string,Game>();
 for(const g of snapshot?.games||[]){if(chinaDate(new Date(g.date))===date)gamesById.set(g.id,{...g,teams:g.teams.map(t=>({...t,name:TEAMS[t.abbr]||t.english}))})}
 const seen=new Set<string>();
 for(const e of results.flatMap(r=>r.events)){
  if(seen.has(e.id)||e.season?.year!==2027||chinaDate(new Date(e.date))!==date)continue;seen.add(e.id);
  const c=e.competitions?.[0];if(!c)continue;const status=c.status||e.status||{},kind=status.type||{};
  const teams:Team[]=(c.competitors||[]).map((t:any)=>({id:t.id,abbr:t.team.abbreviation,name:TEAMS[t.team.abbreviation]||t.team.displayName,english:t.team.displayName,logo:t.team.logo||'',color:t.team.color||'64766b',score:t.score==null||t.score===''?null:Number(t.score),home:t.homeAway==='home',record:t.records?.find((r:any)=>r.type==='total')?.summary||'',quarters:(t.linescores||[]).map((q:any)=>q.value),leaders:(t.leaders||[]).flatMap((l:any)=>(l.leaders||[]).slice(0,1).map((p:any)=>({name:l.name,value:p.value,player:p.athlete.displayName,image:p.athlete.headshot||''})))})).sort((a:Team,b:Team)=>Number(a.home)-Number(b.home));
  if(teams.length!==2)continue;
  gamesById.set(e.id,{id:e.id,date:e.date,state:kind.state,status:kind.shortDetail||kind.description||'',period:status.period||0,clock:status.displayClock||'',complete:!!kind.completed,venue:c.venue?.fullName||'场馆待公布',seasonType:e.season.type,link:`https://www.espn.com/nba/game/_/gameId/${e.id}`,teams});
 }
 const games=[...gamesById.values()].sort((a,b)=>a.date.localeCompare(b.date));
 const okCount=results.filter(r=>r.ok).length;
 if(!games.length&&!okCount&&!snapshot)return {date,games,updatedAt:new Date().toISOString(),error:'暂时无法连接比分数据源，请稍后重试。'};
 return {date,games,updatedAt:okCount?new Date().toISOString():snapshot?.generatedAt||new Date().toISOString(),source:okCount===2?'live':okCount===1?'partial':'snapshot',...(okCount<2?{partial:true}:{})};
}

// The team schedule is a season-wide index for finding a particular matchup.
export async function getTeamSchedule(abbr:string):Promise<Game[]>{
 if(!teamOptions.includes(abbr))throw new Error('请选择一支球队。');
 try{const snapshot=await getSnapshot();return snapshot.games.filter(g=>g.teams.some(t=>t.abbr===abbr)).map(g=>({...g,teams:g.teams.map(t=>({...t,name:TEAMS[t.abbr]||t.english}))}));}catch{}
 const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${abbr.toLowerCase()}/schedule?season=2027`,{signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw new Error('球队赛程暂时无法读取，请稍后重试。');
 const data=await r.json() as {events?:any[]};
 if(!Array.isArray(data.events))throw new Error('球队赛程格式异常。');
 return data.events.filter((e:any)=>e.season?.year===2027&&Array.isArray(e.competitions)&&e.competitions.length).map((e:any)=>{
  const c=e.competitions[0],status=c.status||e.status||{},kind=status.type||{};
  const teams=(c.competitors||[]).map((t:any):Team=>{
   const raw=t.score;const score=raw==null||raw===''?null:typeof raw==='object'?Number(raw.value??raw.displayValue):Number(raw);
   return {id:t.id,abbr:t.team.abbreviation,name:TEAMS[t.team.abbreviation]||t.team.displayName,english:t.team.displayName,logo:t.team.logo||t.team.logos?.find((l:any)=>l.rel?.includes('scoreboard'))?.href||t.team.logos?.[0]?.href||'',color:t.team.color||'64766b',score:Number.isFinite(score)?score:null,home:t.homeAway==='home',record:t.records?.find((x:any)=>x.type==='total')?.summary||'',quarters:(t.linescores||[]).map((q:any)=>Number(q.value??q.displayValue)),leaders:(t.leaders||[]).flatMap((l:any)=>(l.leaders||[]).slice(0,1).map((p:any)=>({name:l.name,value:Number(p.value),player:p.athlete?.displayName||'',image:typeof p.athlete?.headshot==='string'?p.athlete.headshot:p.athlete?.headshot?.href||''})))};
  }).sort((a:Team,b:Team)=>Number(a.home)-Number(b.home));
  return {id:e.id,date:e.date,state:kind.state||'pre',status:kind.shortDetail||kind.description||'',period:status.period||0,clock:status.displayClock||'',complete:!!kind.completed,venue:c.venue?.fullName||'场馆待公布',seasonType:e.seasonType?.type||2,teams,link:`https://www.espn.com/nba/game/_/gameId/${e.id}`};
 }).sort((a:Game,b:Game)=>a.date.localeCompare(b.date));
}
