import {generateDueDiaries,loadJournal} from '../../lib/journal-server';
import {dateInChina} from '../../lib/journal';
const version='2026-07-28';
const tools=[
 {name:'journal_status',description:'查看当前登录用户的观赛日记数量和自动生成设置。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
 {name:'generate_due_diary',description:'按北京时间为当前用户生成已经结束的上一周或上一月的观赛日记；已有日记不会重复生成。',inputSchema:{type:'object',properties:{},additionalProperties:false}},
];
export async function POST(request:Request){
 const userId=request.headers.get('oai-authenticated-user-id');
 if(!userId)return Response.json({jsonrpc:'2.0',id:null,error:{code:-32001,message:'Authentication required'}},{status:401});
 let payload:{jsonrpc?:string;id?:string|number|null;method?:string;params?:{name?:string}};
 try{payload=await request.json()}catch{return Response.json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}})}
 const id=payload.id??null;
 try{
  if(payload.method==='server/discover')return Response.json({jsonrpc:'2.0',id,result:{supportedVersions:[version],capabilities:{tools:{}}}});
  if(payload.method==='tools/list')return Response.json({jsonrpc:'2.0',id,result:{tools}});
  if(payload.method==='tools/call'){
   if(payload.params?.name!=='journal_status'&&payload.params?.name!=='generate_due_diary')return Response.json({jsonrpc:'2.0',id,error:{code:-32602,message:'Unknown tool'}});
   const result=payload.params.name==='journal_status'?await loadJournal(userId):await generateDueDiaries(userId,dateInChina(new Date().toISOString()));
   return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(result)}]}});
  }
  return Response.json({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}});
 }catch{return Response.json({jsonrpc:'2.0',id,result:{content:[{type:'text',text:'日记服务暂时不可用'}],isError:true}})}
}
