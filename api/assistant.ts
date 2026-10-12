declare const process: { env: Record<string, string | undefined> };
import { rateLimit } from './_lib/rateLimit.js';

async function readLiveField(base:string, token:string, fieldId:string){
  const url=`${base}/rest/v1/fields?id=eq.${encodeURIComponent(fieldId)}&select=id,external_id,khasra_no,village,block,district,acreage,crop,variety,expected_harvest_date,clearance_deadline,status,moisture_pct,center_lat,center_lng`;
  const r=await fetch(url,{headers:{apikey:((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY)||'',Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});
  if(!r.ok)return null;const data=await r.json();return data?.[0]||null;
}

const instructions='You are NIRDHOOM Sathi. Answer only from the supplied live field context. Never invent booking, machine ETA, payment, verification, subsidy, buyer offer, weather, harvest forecast or carbon credit. Clearly label demo/indicative values. If remote sensing is discussed, explain that a missing FIRMS/VIIRS detection is not proof of no burning. Use simple English unless Punjabi or Hindi is requested.';

async function askGroq(question:string,safeField:Record<string,unknown>){
  const key=process.env.GROQ_API_KEY;
  if(!key)return null;
  const base=(process.env.GROQ_API_BASE_URL||'https://api.groq.com/openai/v1').replace(/\\/$/,'');
  const response=await fetch(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000),body:JSON.stringify({model:process.env.GROQ_MODEL||process.env.NIRDHOOM_AI_MODEL||'llama-3.3-70b-versatile',messages:[{role:'system',content:instructions},{role:'user',content:`Live field context: ${JSON.stringify(safeField)}\\nFarmer question: ${question}`}],temperature:0.2,max_tokens:300})});
  if(!response.ok)return null;
  const data=await response.json();
  return data?.choices?.[0]?.message?.content||null;
}

async function askOpenAI(question:string,safeField:Record<string,unknown>){
  const key=process.env.OPENAI_API_KEY;
  if(!key)return null;
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`},signal:AbortSignal.timeout(12000),body:JSON.stringify({model:process.env.NIRDHOOM_AI_MODEL||'gpt-5.6-luna',instructions,input:[{role:'user',content:[{type:'input_text',text:`Live field context: ${JSON.stringify(safeField)}\\nFarmer question: ${question}`}]}],max_output_tokens:300})});
  if(!response.ok)return null;
  const data=await response.json();
  return data?.output_text||null;
}

export default async function handler(req:any,res:any){
  if (!rateLimit(req, res, 'api-assistant.ts', 20)) return res.status(429).json({ error: 'Too many requests; please retry shortly.' });
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
  res.setHeader?.('Cache-Control','no-store');
  const body=typeof req.body==='object'&&req.body&&!Array.isArray(req.body)?req.body:{};const{question,field}=body;
  if(!question||typeof question!=='string'||question.length>2000)return res.status(400).json({error:'question is required and must be at most 2000 characters'});
  const auth=String(req.headers?.authorization||'');const token=auth.startsWith('Bearer ')?auth.slice(7):'';
  const aiConfigured=Boolean(process.env.GROQ_API_KEY||process.env.OPENAI_API_KEY);
  const demoMode=process.env.VITE_NIRDHOOM_DEMO_MODE==='true';
  // Live deployments require a verified Supabase session by default; demo-only
  // unauthenticated use is allowed only when demo mode is explicitly enabled.
  const authRequired=!demoMode||process.env.REQUIRE_AUTH_FOR_AI==='true'||aiConfigured||Boolean(field?.dbId);
  if(authRequired){
    if(!token||!((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)||!((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY))return res.status(401).json({error:'Authentication required'});
    try{const verify=await fetch(`${((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) || process.env.VITE_SUPABASE_URL)}/auth/v1/user`,{headers:{apikey:((process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY) || process.env.VITE_SUPABASE_PUBLISHABLE_KEY),Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(8000)});if(!verify.ok)return res.status(401).json({error:'Invalid session'})}catch{return res.status(401).json({error:'Authentication check failed'})}
  }
  let liveField=null;
  const supabaseUrl=(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  if (field?.dbId) {
    liveField=await readLiveField(supabaseUrl || '',token,String(field.dbId));
    // A requested database-backed field must never silently fall back to client data.
    if (!liveField) return res.status(404).json({error:'Saved field not found or not accessible to this account'});
  } else if (!demoMode) {
    // In live mode the client cannot manufacture field facts by posting an arbitrary
    // object. Require a saved field ID and derive the answer context from Supabase.
    return res.status(400).json({error:'A saved field ID is required for live field-specific answers'});
  }
  const source=liveField||(demoMode?(field||{}):{});
  const safeField={id:source.id||'',village:typeof source.village==='string'?source.village:'',block:typeof source.block==='string'?source.block:'',acres:Number(source.acreage??source.acres??0),variety:typeof source.variety==='string'?source.variety:'',crop:typeof source.crop==='string'?source.crop:'Paddy',status:typeof source.status==='string'?source.status:'',machine:typeof source.machine==='string'?source.machine:'',payout:Number(source.payout||0),harvest:source.expected_harvest_date||source.harvest||'',deadline:source.clearance_deadline||source.deadline||''};
  try{
    const groqAnswer=await askGroq(question,safeField);
    if(groqAnswer)return res.status(200).json({answer:groqAnswer,mode:liveField?'groq-live-record':'groq-demo-context'});
    const openaiAnswer=await askOpenAI(question,safeField);
    if(openaiAnswer)return res.status(200).json({answer:openaiAnswer,mode:liveField?'openai-live-record':'openai-demo-context'});
  }catch{/* safe fallback */}
  const q=question.toLowerCase();let answer=`For ${safeField.village||'your field'}, the current record shows ${safeField.acres} acres of ${safeField.variety||safeField.crop}. `;
  if(q.includes('machine')||q.includes('baler'))answer+=`A live machine ETA should only be reported from dispatch/GPS data; this field record currently shows ${safeField.machine||'no machine assigned'}.`;
  else if(q.includes('pay')||q.includes('money'))answer+=`The current displayed amount is ${safeField.payout?`₹${Math.round(safeField.payout)}`:'not set'}. Final settlement must come from the payment ledger/webhook.`;
  else if(q.includes('verify')||q.includes('burn'))answer+='Verification should combine field geometry, operational evidence and remote-sensing observations. A missing FIRMS detection is not absolute proof of no burning.';
  else if(q.includes('harvest'))answer+=`The field harvest estimate is ${safeField.harvest||'not set'}. Weather and crop-maturity services should refine it in production.`;
  else answer+='I can help with clearance, machine status, verification, payment, harvest timing and residue pathways.';
  return res.status(200).json({answer,mode:'safe-fallback'});
}
