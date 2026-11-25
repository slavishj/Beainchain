import webpush from "npm:web-push@3.6.7";
import {createClient} from "npm:@supabase/supabase-js@2.49.8";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {auth:{persistSession:false}});
Deno.serve(async request => {
 const token = request.headers.get("x-bc-dispatch");
 if (request.method !== "POST" || !token || !/^[a-f0-9-]{36}$/.test(token)) return new Response(null,{status:403});
 const config = await db.from("bc_push_config").select("public_key,private_key").eq("dispatcher",token).maybeSingle();
 if (config.error || !config.data) return new Response(null,{status:403});
 if (!config.data.public_key) {
  const keys = webpush.generateVAPIDKeys();
  const saved = await db.from("bc_push_config").update({public_key:keys.publicKey,private_key:keys.privateKey}).eq("dispatcher",token).is("public_key",null);
  return new Response(null,{status:saved.error?500:204});
 }
 const jobs = await db.rpc("bc_push_claim");
 if (jobs.error) return new Response(null,{status:500});
 const vapidDetails={subject:"https://slavishj.github.io/Beainchain/", publicKey:config.data.public_key,privateKey:config.data.private_key};
 await Promise.all(jobs.data.map(async job=>{
  const changed=Object.keys(job.items).filter(k=>job.previous[k]?.[0]!==job.items[k][0]);
  const count=Object.values(job.items).reduce((sum:number,row:any)=>sum+Number(row[1]),0);
  const device=()=>db.from("bc_push_devices");
  if(changed.length){
   const [kind,target]=changed[0].split(":");
   const title=changed.length>1?"BrainChain updates":kind==="turn"?"Your turn in BrainChain":"New BrainChain message";
   const payload=JSON.stringify({title,kind,target,count,tag:"brainchain-"+changed[0]});
   try {
    const outgoing=webpush.generateRequestDetails(job.sub,payload,{vapidDetails,TTL:3600,urgency:"high"});
    const response=await fetch(outgoing.endpoint,{method:"POST",headers:outgoing.headers,body:outgoing.body,redirect:"error",signal:AbortSignal.timeout(12000)});
    if(response.status===404||response.status===410){await device().delete().eq("id",job.device).eq("lease",job.claim);return;}
    if(!response.ok)return;
   } catch {return;}
  }
  await device().update({baseline:job.items,lease:null,due:new Date().toISOString()}).eq("id",job.device).eq("lease",job.claim);
 }));
 return new Response(null,{status:204});
});
