import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main(){
 const {prisma}=await import('../../server/prisma');
 try{await prisma.$queryRaw`SELECT 1`;console.log('Database connected');}catch(e){const err=e as {code?:string;message?:string}; const message=err.message??''; console.log(JSON.stringify({database:'unavailable',code:err.code,reason:message.includes('Tenant or user not found')?'Tenant or user not found':message.includes('reach')?'Host unreachable':message.includes('authentication')?'Authentication failed':'Connection failed'}));}finally{await prisma.$disconnect();}
 const {notionDocuments}=await import('../../lib/integrations/sources');try{const data=await notionDocuments();console.log('Notion documents',data.documents.length);}catch(e){console.log('Notion:',e instanceof Error?e.message:'failed');}
 try{const response=await fetch('http://127.0.0.1:8000/predict',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ML_API_KEY}`},body:JSON.stringify({cumulative_rainfall_72h:180,river_level_trend:1.5,soil_saturation_index:.8,elevation_m:30}),signal:AbortSignal.timeout(15000)});console.log('ML',response.status,await response.text());}catch(e){console.log('ML request error',e instanceof Error?e.name:'unknown');}
}
void main();
