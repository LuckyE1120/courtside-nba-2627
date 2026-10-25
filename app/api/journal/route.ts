import {getChatGPTUser} from '../../chatgpt-auth';
import {env} from 'cloudflare:workers';
import {loadJournal,removeWatched,saveFrequency,saveWatched} from '../../../lib/journal-server';
import {MOODS,type WatchedGame} from '../../../lib/journal';
export async function GET(){const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});return Response.json({...await loadJournal(user.userId),aiReady:!!env.OPENAI_API_KEY})}
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 let body:Record<string,unknown>;try{body=await request.json()}catch{return Response.json({error:'请求格式无效'},{status:400})}
 if(body.action==='frequency'&&(body.frequency==='week'||body.frequency==='month'))await saveFrequency(user.userId,body.frequency);
 else if(body.action==='delete'&&typeof body.gameId==='string')await removeWatched(user.userId,body.gameId);
 else if(body.action==='upsert'){
  const r=body.record as WatchedGame|undefined;
  if(!r||typeof r.gameId!=='string'||r.gameId.length>100||!/^\d{4}-\d{2}-\d{2}T/.test(r.date)||typeof r.away!=='string'||typeof r.home!=='string'||typeof r.note!=='string'||r.note.length>1000||!(!r.mood||MOODS.includes(r.mood)))return Response.json({error:'记录格式无效'},{status:400});
  await saveWatched(user.userId,r);
 }else return Response.json({error:'操作无效'},{status:400});
 return Response.json(await loadJournal(user.userId));
}
