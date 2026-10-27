'use client';

import {useEffect,useRef,useState} from 'react';
import type {Game} from '../lib/nba';
import {playerName} from '../lib/player-names';

type Metric='PTS'|'REB'|'AST'|'STL';
type PlayerLine={id:string;name:string;team:string;image:string;stats:Record<Metric,number>};
type State={key:string;lines:PlayerLine[];loading:boolean;failedIds:string[]};

const metrics: {key:Metric;title:string;label:string;unit:string}[]=[
  {key:'PTS',title:'得分聚光灯',label:'单场得分',unit:'PTS'},
  {key:'REB',title:'篮板聚光灯',label:'单场篮板',unit:'REB'},
  {key:'AST',title:'助攻聚光灯',label:'单场助攻',unit:'AST'},
  {key:'STL',title:'抢断聚光灯',label:'单场抢断',unit:'STL'},
];
const cache=new Map<string,{expiresAt:number;request:Promise<PlayerLine[]>}>();

function loadGame(game:Game,force=false):Promise<PlayerLine[]>{
  const existing=cache.get(game.id);
  if(!force&&existing&&existing.expiresAt>Date.now())return existing.request;
  const request=fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${encodeURIComponent(game.id)}`,{signal:AbortSignal.timeout(25000)})
    .then(async response=>{if(!response.ok)throw new Error('技术统计暂不可用');return response.json()})
    .then(raw=>{
      const lines:PlayerLine[]=[];
      for(const group of raw?.boxscore?.players||[]){
        const team=game.teams.find(item=>item.id===String(group.team?.id||''));
        for(const set of group.statistics||[]){
          const names:string[]=set.names||[];
          for(const entry of set.athletes||[]){
            if(entry.didNotPlay||!Array.isArray(entry.stats)||!entry.stats.length)continue;
            const stats=Object.fromEntries(metrics.map(metric=>{
              const value=Number(entry.stats[names.indexOf(metric.key)]);
              return [metric.key,Number.isFinite(value)?value:0];
            })) as Record<Metric,number>;
            lines.push({id:String(entry.athlete?.id||entry.athlete?.displayName||''),name:entry.athlete?.displayName||'球员',team:team?.name||group.team?.displayName||'',image:entry.athlete?.headshot?.href||'',stats});
          }
        }
      }
      return lines;
    }).catch(error=>{if(cache.get(game.id)?.request===request)cache.delete(game.id);throw error});
  cache.set(game.id,{expiresAt:Date.now()+5*60*1000,request});
  return request;
}

export default function DailySpotlights({games,refreshToken,refreshKey}:{games:Game[];refreshToken:number;refreshKey?:string}){
  const key=games.map(game=>game.id).join(',');
  const [state,setState]=useState<State>({key:'',lines:[],loading:false,failedIds:[]});
  const lastManualRefresh=useRef(refreshToken);
  useEffect(()=>{
    let active=true;
    const force=lastManualRefresh.current!==refreshToken;
    lastManualRefresh.current=refreshToken;
    if(!games.length){setState({key,lines:[],loading:false,failedIds:[]});return()=>{active=false}};
    setState({key,lines:[],loading:true,failedIds:[]});
    Promise.allSettled(games.map(game=>loadGame(game,force))).then(results=>{
      if(active)setState({key,lines:results.flatMap(result=>result.status==='fulfilled'?result.value:[]),loading:false,failedIds:games.filter((_,index)=>results[index].status==='rejected').map(game=>game.id)});
    });
    return()=>{active=false};
  },[key,refreshToken,refreshKey]);

  const current=state.key===key?state:{key,lines:[],loading:games.length>0,failedIds:[]};
  return <aside className="spotlight-stack" aria-label="每日球员数据榜">
    {metrics.map(metric=>{
      const category:Record<Exclude<Metric,'STL'>,string>={PTS:'points',REB:'rebounds',AST:'assists'};
      const backup=metric.key==='STL'?[]:games.filter(game=>current.failedIds.includes(game.id)).flatMap(game=>game.teams.flatMap(team=>team.leaders.filter(leader=>leader.name===category[metric.key as Exclude<Metric,'STL'>]).map(leader=>({id:`${game.id}-${team.id}-${leader.player}`,name:leader.player,team:team.name,image:leader.image,stats:{PTS:0,REB:0,AST:0,STL:0,[metric.key]:Number(leader.value)||0} as Record<Metric,number>}))));
      const top=[...current.lines,...backup].filter(line=>line.stats[metric.key]>0).sort((a,b)=>b.stats[metric.key]-a.stats[metric.key]||a.name.localeCompare(b.name)).slice(0,3);
      return <section className="leaders" key={metric.key} aria-label={metric.title}>
        <div><h3>{metric.title}</h3><span>已完赛 · {metric.label}</span></div>
        {top.length?top.map((line,index)=><div className="leader" key={`${line.id}-${index}`}><b>{String(index+1).padStart(2,'0')}</b><span className="player-photo">{line.image&&<img src={line.image} alt="" loading="lazy"/>}</span><div><strong title={line.name}>{playerName(line.name)}</strong><span>{line.team}</span></div><em>{line.stats[metric.key]}<small>{metric.unit}</small></em></div>):<p className="muted">{current.loading?'正在整理球员技术统计…':current.failedIds.length?'技术统计暂不可用，请稍后刷新重试。':games.length?'该项统计暂未公布。':'完赛后显示当日领先球员。'}</p>}
        <small className="leader-note">{!games.length?'比赛结束后根据球员技术统计更新。':`${current.failedIds.length?metric.key==='STL'?'部分场次抢断数据暂不可用；':'部分场次使用赛程概览数据；':'来自已返回的完赛技术统计；'}按${metric.label}排序。`}</small>
      </section>;
    })}
  </aside>;
}
