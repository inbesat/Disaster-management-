import { loadEnvConfig } from '@next/env';
loadEnvConfig(process.cwd());
async function main() {
 const fs = await import('node:fs');
 const results: Record<string, unknown> = {};
 const { prisma } = await import('../../server/prisma');
 try { await prisma.$queryRaw`SELECT 1`; results.database = 'connected'; } catch (error) { results.database = { status: 'unavailable', code: (error as {code?:string}).code ?? 'connection-error' }; }
 const { naturalEvents, spaceWeather, countryInformation, notionDocuments } = await import('../../lib/integrations/sources');
 await Promise.allSettled(Object.entries({ events: naturalEvents, spaceWeather, countries: () => countryInformation('India'), notion: notionDocuments }).map(async ([name,fn]) => {try { const result=await fn(); results[name]={ok:true,fields:Object.keys(result)}; }catch (error) {results[name]={ok:false,error:error instanceof Error?error.message:"unavailable"};}}));
 try {const response=await fetch('http://127.0.0.1:8000/predict',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.ML_API_KEY}`},body:JSON.stringify({cumulative_rainfall_72h:180,river_level_trend:1.5,soil_saturation_index:.8,elevation_m:30}),signal:AbortSignal.timeout(15000)});results.ml={status:response.status,data:response.ok?await response.json():null};}catch{results.ml={ok:false};}
 try {const {getEmergencyGraph} = await import('../../lib/agents/graph'); const state=await getEmergencyGraph().invoke({incidentDetails:'Heavy rainfall reported near Patna; 20 residents request assistance. Shelter and road safety have not been verified.',availableInventory:{boats:4,medicalKits:20},hoardingLimitPercent:50});results.graph={status:state.status,planLength:state.evacuationPlan.length,resources:state.resourceAllocations,logs:state.logs};}catch(error){results.graph={ok:false,error:error instanceof Error?error.name:'error'};}
 fs.writeFileSync('tmp/audit/integration-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
 await prisma.$disconnect();
}
void main().catch(()=>{console.log('Integration test aborted');process.exitCode=1});
