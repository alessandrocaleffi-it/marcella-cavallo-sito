// Draft backend. Deploy only after configuring secrets, database, sender and privacy notice.
const RECIPIENT = 'marcellacavallo2@gmail.com';
const DATA_SOURCE = '08359bc5-5bd7-4290-a3df-e29643992ec9';
const SERVICES = {MTC:'MTC',Shiatsu:'Shiatsu',Yoga:'Yoga',Respiro:'Altro',Orientamento:'Altro'};
export function validate(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error('invalid');
  for (const [key,max] of Object.entries({name:100,email:254,phone:40,notes:500,service:20,location:20,date:10,requestId:36,turnstileToken:2048})) {
    if (typeof p[key] !== 'string' || p[key].length > max) throw Error('invalid');
    p[key] = p[key].trim();
  }
  if (!p.name || /[\r\n]/.test(p.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) throw Error('invalid');
  if (!Object.hasOwn(SERVICES,p.service) || !['Monticello','Missaglia'].includes(p.location)) throw Error('invalid');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date) || new Date(p.date+'T12:00:00Z').toISOString().slice(0,10)!==p.date) throw Error('invalid');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(p.date<today || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(p.requestId) || p.consent!==true || p.website) throw Error('invalid');
  return p;
}
export function notionPayload(p) {
  const rich = content => [{type:'text',text:{content}}];
  return {parent:{type:'data_source_id',data_source_id:DATA_SOURCE},properties:{
    Nome:{title:rich(p.name)},Email:{email:p.email},Telefono:{phone_number:p.phone||null},
    Canale:{select:{name:'Sito'}},Stato:{select:{name:'Nuovo'}},Tipologia:{select:{name:'Prospect'}},
    Interesse:{multi_select:[{name:SERVICES[p.service]}]},'Consenso contatto':{checkbox:true},
    'Prossima azione':{rich_text:rich('Rispondere alla richiesta da sito e concordare i dettagli')},
    'Note operative':{rich_text:rich(`Richiesta da sito\nID: ${p.requestId}\nPercorso: ${p.service}\nSede: ${p.location}\nData preferita: ${p.date}\nNote: ${p.notes||'—'}`)}
  }};
}
export function emailPayload(p,from) {
  return {from,to:[RECIPIENT],reply_to:p.email,subject:'Nuova richiesta da sito — Marcella Cavallo',
    text:`Richiesta da sito\nID: ${p.requestId}\nNome: ${p.name}\nEmail: ${p.email}\nTelefono: ${p.phone||'—'}\nPercorso: ${p.service}\nSede: ${p.location}\nData preferita: ${p.date}\nNote: ${p.notes||'—'}\n\nLa richiesta non conferma un appuntamento.`};
}
async function api(url,key,body,headers={}) {
  const r=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!r.ok) throw Error('provider_error');
  const result=await r.json(); if(!result.id) throw Error('invalid_provider_response'); return result.id;
}
async function digest(data){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(data))))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export default {async fetch(req,env) {
  const origin=req.headers.get('Origin');
  const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim()).filter(Boolean);
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed.includes(origin)) return reply(403,{status:'error',code:'origin_denied'});
  headers['Access-Control-Allow-Origin']=origin;
  headers['Access-Control-Allow-Headers']='Content-Type';headers['Access-Control-Allow-Methods']='POST, OPTIONS';
  if(new URL(req.url).pathname!='/request')return reply(404,{status:'error'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply(405,{status:'error'});
  if(!env.DB || !env.NOTION_TOKEN || !env.RESEND_API_KEY || !env.EMAIL_FROM || !env.TURNSTILE_SECRET)return reply(503,{status:'error',code:'not_configured'});
  let p;
  try {
    if(!req.headers.get('Content-Type')?.startsWith('application/json'))return reply(415,{status:'error'});
    const reader=req.body.getReader();let size=0;const chunks=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();return reply(413,{status:'error'});}chunks.push(value);}
    const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
    p=validate(JSON.parse(new TextDecoder().decode(bytes)));
  }catch{return reply(400,{status:'error',code:'invalid_fields'});}
  try {
    const tokenResult=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:p.turnstileToken}),signal:AbortSignal.timeout(10000)}).then(r=>r.json());
    if(!tokenResult.success || tokenResult.action!=='request' || !(env.ALLOWED_HOSTNAMES||'').split(',').includes(tokenResult.hostname))return reply(400,{status:'error',code:'verification_failed'});
    const payload={name:p.name,email:p.email,phone:p.phone,service:p.service,location:p.location,date:p.date,notes:p.notes,consent:p.consent,requestId:p.requestId};
    const hash=await digest(payload);
    const created=await env.DB.prepare('INSERT OR IGNORE INTO requests (id,payload_hash,payload,state,created_at) VALUES (?,?,?,\'processing\',?)').bind(p.requestId,hash,JSON.stringify(payload),new Date().toISOString()).run();
    if(!created.meta.changes){
      const row=await env.DB.prepare('SELECT payload_hash,state FROM requests WHERE id=?').bind(p.requestId).first();
      if(!row || row.payload_hash!==hash)return reply(409,{status:'error',code:'id_conflict'});
      return row.state==='complete'?reply(200,{status:'success',requestId:p.requestId}):reply(202,{status:'received',requestId:p.requestId,message:'Richiesta ricevuta, in elaborazione. Non inviarla di nuovo.'});
    }
    // Persist before calling providers. Ambiguous failures remain retained for operator reconciliation.
    try {
      const emailId=await api('https://api.resend.com/emails',env.RESEND_API_KEY,emailPayload(p,env.EMAIL_FROM),{'Idempotency-Key':`request-${p.requestId}`});
      await env.DB.prepare('UPDATE requests SET email_id=?,state=\'email_accepted\' WHERE id=?').bind(emailId,p.requestId).run();
      const notionId=await api('https://api.notion.com/v1/pages',env.NOTION_TOKEN,notionPayload(p),{'Notion-Version':'2025-09-03'});
      await env.DB.prepare('UPDATE requests SET notion_id=?,state=\'complete\' WHERE id=?').bind(notionId,p.requestId).run();
      return reply(200,{status:'success',requestId:p.requestId});
    }catch{
      await env.DB.prepare('UPDATE requests SET state=\'needs_review\' WHERE id=?').bind(p.requestId).run();
      return reply(202,{status:'received',requestId:p.requestId,message:'Richiesta ricevuta. La consegna è in verifica; non inviarla di nuovo.'});
    }
  }catch{return reply(503,{status:'error',code:'temporarily_unavailable'});}
}};
