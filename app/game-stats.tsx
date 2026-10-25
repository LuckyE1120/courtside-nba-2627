'use client';
import {useEffect,useState} from 'react';
import type {Game,Team} from '../lib/nba';

type Stat={name:string;displayValue:string};
type Player={name:string;stats:Record<string,string>};
type BoxTeam={id:string;stats:Stat[];players:Player[]};

const fields=[['fieldGoalPct','投篮命中率','%'],['threePointFieldGoalPct','三分命中率','%'],['freeThrowPct','罚球命中率','%'],['totalRebounds','篮板',''],['assists','助攻',''],['turnovers','失误','']];

function parseBoxscore(raw:any):BoxTeam[]{
 const teams:BoxTeam[]=(raw?.boxscore?.teams||[]).map((entry:any)=>({id:String(entry.team?.id||''),stats:Array.isArray(entry.statistics)?entry.statistics:[],players:[]}));
 for(const group of raw?.boxscore?.players||[]){
  const team=teams.find(t=>t.id===String(group.team?.id||''));if(!team)continue;
  for(const set of group.statistics||[]){
   const names:string[]=set.names||[];
   for(const athlete of set.athletes||[]){
    if(athlete.didNotPlay||!Array.isArray(athlete.stats)||!athlete.stats.length)continue;
    team.players.push({name:athlete.athlete?.displayName||'球员',stats:Object.fromEntries(names.map((name,i)=>[name,String(athlete.stats[i]??'—')]))});
   }
  }
 }
 return teams;
}

function fallback(team:Team){return team.leaders.filter(l=>l.player).map(l=>`${l.player} · ${l.name==='points'?'得分':l.name==='rebounds'?'篮板':l.name==='assists'?'助攻':l.name} ${l.value}`).join('　');}

export default function GameStats({game}:{game:Game}){
 const [box,setBox]=useState<BoxTeam[]|null>(null),[loading,setLoading]=useState(false),[failed,setFailed]=useState(false);
 useEffect(()=>{
  setBox(null);setFailed(false);
  if(game.state==='pre')return;
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),30000);setLoading(true);
  fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(game.id)}`,{signal:controller.signal})
   .then(async response=>{if(!response.ok)throw new Error('统计暂不可用');return parseBoxscore(await response.json())})
   .then(data=>{if(!controller.signal.aborted){setBox(data);setFailed(!data.some(t=>t.stats.length||t.players.length))}})
   .catch(()=>{if(!controller.signal.aborted)setFailed(true)})
   .finally(()=>{clearTimeout(timeout);if(!controller.signal.aborted)setLoading(false)});
  return ()=>{clearTimeout(timeout);controller.abort()};
 },[game.id,game.state]);
 const teamBoxes=game.teams.map(team=>box?.find(item=>item.id===team.id));
 const hasTeamStats=teamBoxes.every(item=>item?.stats.length);
 const hasPlayers=teamBoxes.some(item=>item?.players.length);
 return <section className="game-stat-section" aria-label="比赛数据统计">
  <div className="game-stat-heading"><h3>数据统计</h3><span>{game.complete?'全场技术统计':game.state==='in'?'实时统计 · 可能延迟':'赛前'}</span></div>
  {game.state==='pre'?<p className="game-stat-note">比赛开始后公布球队和球员数据。</p>:<>
   {loading&&<p className="game-stat-note" role="status">正在获取技术统计…</p>}
   {hasTeamStats&&<div className="team-comparison"><h4>球队对比</h4><div className="comparison-head"><span>{game.teams[0].name}</span><span>统计项</span><span>{game.teams[1].name}</span></div>{fields.map(([key,label,suffix])=><div className="comparison-row" key={key}><b>{teamBoxes[0]?.stats.find(s=>s.name===key)?.displayValue??'—'}{teamBoxes[0]?.stats.some(s=>s.name===key)?suffix:''}</b><span>{label}</span><b>{teamBoxes[1]?.stats.find(s=>s.name===key)?.displayValue??'—'}{teamBoxes[1]?.stats.some(s=>s.name===key)?suffix:''}</b></div>)}</div>}
   {hasPlayers&&game.teams.map((team,i)=>{const players=teamBoxes[i]?.players||[];return players.length?<div className="player-box" key={team.id}><h4>{team.name}球员数据</h4><div className="player-table-wrap"><table><thead><tr><th>球员</th><th>时间</th><th>得分</th><th>篮板</th><th>助攻</th><th>投篮</th><th>三分</th><th>失误</th><th>正负值</th></tr></thead><tbody>{players.map((player,index)=><tr key={`${player.name}-${index}`}><th>{player.name}</th>{['MIN','PTS','REB','AST','FG','3PT','TO','+/-'].map(key=><td key={key}>{player.stats[key]??'—'}</td>)}</tr>)}</tbody></table></div></div>:null})}
   {(failed||!loading&&!hasTeamStats&&!hasPlayers)&&<div className="game-stat-note" role="status">技术统计暂未公布或数据源暂不可用。{game.teams.map(team=>fallback(team)).filter(Boolean).length>0&&<div className="stat-leaders">{game.teams.map(team=>{const text=fallback(team);return text?<p key={team.id}><strong>{team.name}</strong> {text}</p>:null})}</div>}</div>}
  </>}
 </section>;
}
