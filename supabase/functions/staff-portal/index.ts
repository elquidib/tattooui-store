import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
const json = (body: unknown, status=200) => new Response(JSON.stringify(body), { status, headers: cors });
const enc = new TextEncoder();
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = (b: Uint8Array) => [...b].map(x=>x.toString(16).padStart(2,"0")).join("");
async function sha(s:string){ return hex(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(s)))); }
async function pinHash(pin:string,salt:string){
 const key=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveBits"]);
 const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt:unb64(salt),iterations:210000,hash:"SHA-256"},key,256);
 return b64(new Uint8Array(bits));
}
function equal(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
function randomToken(){const b=crypto.getRandomValues(new Uint8Array(32));return b64(b).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function bearer(req:Request){return (req.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"").trim();}
async function adminUser(req:Request){
 const token=bearer(req); if(!token) return null;
 const {data,error}=await db.auth.getUser(token); if(error||!data.user)return null;
 const {data:p}=await db.from("profiles").select("role").eq("id",data.user.id).maybeSingle();
 return p?.role==="admin"?data.user:null;
}
async function staffSession(req:Request){
 const token=bearer(req);if(!token)return null;
 const tokenHash=await sha(token);
 const {data:s}=await db.from("staff_sessions").select("staff_id,expires_at").eq("token_hash",tokenHash).maybeSingle();
 if(!s||new Date(s.expires_at).getTime()<Date.now()){if(s)await db.from("staff_sessions").delete().eq("token_hash",tokenHash);return null;}
 const {data:a}=await db.from("staff_accounts").select("id,username,display_name,active").eq("id",s.staff_id).maybeSingle();
 if(!a?.active)return null;
 return {tokenHash,account:a};
}
async function readJson(req:Request){try{return await req.json();}catch{return {};}}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const body=await readJson(req);const action=String(body.action||"");
  if(action==="login"){
   const username=String(body.username||"").trim().toLowerCase(),pin=String(body.pin||"");
   if(!/^[a-z0-9._-]{3,32}$/.test(username)||!/^[0-9]{6}$/.test(pin))return json({error:"اسم المستخدم أو PIN غير صحيح."},401);
   const {data:a}=await db.from("staff_accounts").select("*").eq("username",username).maybeSingle();
   if(!a||!a.active||!a.pin_hash||!a.pin_salt)return json({error:"اسم المستخدم أو PIN غير صحيح."},401);
   if(a.locked_until&&new Date(a.locked_until).getTime()>Date.now())return json({error:"تم إيقاف الدخول مؤقتاً. حاولي بعد 15 دقيقة."},429);
   const candidate=await pinHash(pin,a.pin_salt);
   if(!equal(candidate,a.pin_hash)){
    const attempts=(a.failed_attempts||0)+1,locked=attempts>=5?new Date(Date.now()+15*60*1000).toISOString():null;
    await db.from("staff_accounts").update({failed_attempts:attempts>=5?0:attempts,locked_until:locked,updated_at:new Date().toISOString()}).eq("id",a.id);
    return json({error:locked?"محاولات كثيرة. حاولي بعد 15 دقيقة.":"اسم المستخدم أو PIN غير صحيح."},401);
   }
   const token=randomToken(),tokenHash=await sha(token),expires=new Date(Date.now()+12*60*60*1000).toISOString();
   await db.from("staff_accounts").update({failed_attempts:0,locked_until:null,updated_at:new Date().toISOString()}).eq("id",a.id);
   await db.from("staff_sessions").delete().lt("expires_at",new Date().toISOString());
   const ins=await db.from("staff_sessions").insert({token_hash:tokenHash,staff_id:a.id,expires_at:expires});
   if(ins.error)throw ins.error;
   return json({token,expires_at:expires,staff:{id:a.id,username:a.username,display_name:a.display_name}});
  }
  if(action==="logout"){
   const token=bearer(req);if(token)await db.from("staff_sessions").delete().eq("token_hash",await sha(token));
   return json({ok:true});
  }
  if(action.startsWith("admin_")){
   const user=await adminUser(req);if(!user)return json({error:"غير مصرح. سجّل دخول المسؤول من جديد."},401);
   if(action==="admin_list"){
    const {data,error}=await db.from("staff_accounts").select("id,username,display_name,active,failed_attempts,locked_until,created_at,updated_at").order("created_at");
    if(error)throw error;return json({staff:data||[]});
   }
   if(action==="admin_save"){
    const id=String(body.id||"").trim(),username=String(body.username||"").trim().toLowerCase(),display=String(body.display_name||"").trim(),pin=String(body.pin||"");
    if(!/^[a-z0-9._-]{3,32}$/.test(username)||!display)return json({error:"أدخل اسم مستخدم من 3 إلى 32 حرفاً واسم الموظفة."},400);
    if(pin&&!/^[0-9]{6}$/.test(pin))return json({error:"PIN خاصو يكون 6 أرقام بالضبط."},400);
    if(!id&&!pin)return json({error:"PIN من 6 أرقام مطلوب عند إنشاء موظفة جديدة."},400);
    const payload:any={username,display_name:display,active:body.active!==false,updated_at:new Date().toISOString()};
    if(pin){const salt=b64(crypto.getRandomValues(new Uint8Array(16)));payload.pin_salt=salt;payload.pin_hash=await pinHash(pin,salt);payload.failed_attempts=0;payload.locked_until=null;}
    const result=id?await db.from("staff_accounts").update(payload).eq("id",id).select("id,username,display_name,active").single():await db.from("staff_accounts").insert(payload).select("id,username,display_name,active").single();
    if(result.error)throw result.error;
    if(body.active===false||pin)await db.from("staff_sessions").delete().eq("staff_id",result.data.id);
    return json({staff:result.data});
   }
   return json({error:"Unknown admin action"},400);
  }
  const session=await staffSession(req);if(!session)return json({error:"انتهت الجلسة. سجّلي الدخول من جديد."},401);
  if(action==="list_orders"){
   // Load every order in stable pages so repeat-customer counts never silently stop at 250.
   const orders:any[]=[];
   const pageSize=1000;
   for(let from=0;;from+=pageSize){
    const {data:page,error}=await db.from("orders")
     .select("id,order_number,customer_name,phone,city,address,notes,total,subtotal,shipping,status,created_at")
     .order("created_at",{ascending:false})
     .order("id",{ascending:false})
     .range(from,from+pageSize-1);
    if(error)throw error;
    orders.push(...(page||[]));
    if(!page||page.length<pageSize)break;
   }
   // Keep PostgREST URLs bounded: the full order history can contain hundreds or thousands of IDs.
   const ids=(orders||[]).map(o=>o.id);
   const allItems:any[]=[];
   const allFollowups:any[]=[];
   const idBatchSize=100;
   for(let i=0;i<ids.length;i+=idBatchSize){
    const batch=ids.slice(i,i+idBatchSize);
    const [items,followups]=await Promise.all([
     db.from("order_items").select("order_id,product_name,quantity,line_total").in("order_id",batch),
     db.from("staff_order_followups").select("order_id,updated_at").in("order_id",batch)
    ]);
    if(items.error)throw items.error;
    if(followups.error)throw followups.error;
    allItems.push(...(items.data||[]));
    allFollowups.push(...(followups.data||[]));
   }
   return json({orders:orders||[],items:allItems,followups:allFollowups,staff:session.account});
  }
  if(action==="mark_call_later"){
   const id=String(body.order_id||"");const {data:o,error}=await db.from("orders").select("id,status").eq("id",id).maybeSingle();
   if(error)throw error;if(!o||o.status!=="new")return json({error:"هذا الطلب لم يعد جديداً."},409);
   const r=await db.from("staff_order_followups").upsert({order_id:id,created_by:session.account.id,updated_at:new Date().toISOString()},{onConflict:"order_id"});if(r.error)throw r.error;
   await db.from("staff_order_actions").insert({order_id:id,staff_id:session.account.id,action_type:"call_later"});
   return json({ok:true});
  }
  if(action==="set_status"){
   const id=String(body.order_id||""),status=String(body.status||"");
   if(!["confirmed","cancelled"].includes(status))return json({error:"الحالة غير مسموحة."},400);
   const {data:o,error}=await db.from("orders").select("id,status").eq("id",id).maybeSingle();
   if(error)throw error;if(!o||o.status!=="new")return json({error:"هذا الطلب لم يعد جديداً."},409);
   const r=await db.from("orders").update({status,updated_at:new Date().toISOString()}).eq("id",id).eq("status","new").select("id").maybeSingle();
   if(r.error)throw r.error;if(!r.data)return json({error:"تم تغيير الطلب من طرف مستخدم آخر. حدّثي القائمة."},409);
   await db.from("staff_order_actions").insert({order_id:id,staff_id:session.account.id,action_type:status});
   await db.from("staff_order_followups").delete().eq("order_id",id);
   return json({ok:true});
  }
  return json({error:"Unknown action"},400);
 }catch(e){console.error("staff-api",e);return json({error:"وقع مشكل غير متوقع. عاودي المحاولة."},500);}
});