import {getChatGPTUser} from '../../../chatgpt-auth';
import {generateDiary} from '../../../../lib/journal-server';
import {periodBounds} from '../../../../lib/journal';
export async function POST(request:Request){
 const user=await getChatGPTUser();if(!user)return Response.json({error:'请先登录'},{status:401});
 let body:{period?:string;from?:string;to?:string};try{body=await request.json()}catch{return Response.json({error:'请求格式无效'},{status:400})}
 if((body.period!=='week'&&body.period!=='month')||!body.from||!body.to||!/^20\d\d-\d\d-\d\d$/.test(body.from)||periodBounds(body.from,body.period).to!==body.to)return Response.json({error:'周期无效'},{status:400});
 try{const result=await generateDiary(user.userId,body.period,body.from,body.to,true);return Response.json(result,{status:result.status==='missing_key'?503:result.status==='empty'?400:200})}catch{return Response.json({error:'生成失败，请稍后重试'},{status:502})}
}
