import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireSuperAdmin } from '@/lib/super-admin';

const PLANS=['starter','pro','team'] as const;
const INTERVALS=['month','year'] as const;
const VARIANTS:Record<string,string|undefined>={starter:process.env.LEMON_SQUEEZY_STARTER_VARIANT_ID,pro:process.env.LEMON_SQUEEZY_PRO_VARIANT_ID,team:process.env.LEMON_SQUEEZY_TEAM_VARIANT_ID,starter_year:process.env.LEMON_SQUEEZY_STARTER_ANNUAL_VARIANT_ID,pro_year:process.env.LEMON_SQUEEZY_PRO_ANNUAL_VARIANT_ID,team_year:process.env.LEMON_SQUEEZY_TEAM_ANNUAL_VARIANT_ID};
const headers=()=>({Authorization:'Bearer '+process.env.LEMON_SQUEEZY_API_KEY,Accept:'application/vnd.api+json','Content-Type':'application/vnd.api+json'});
const variantIds=(plans:string[],intervals:string[])=>plans.flatMap(p=>intervals.map(i=>VARIANTS[i==='year'?p+'_year':p])).filter(Boolean) as string[];

export async function GET(){
 const {allowed}=await requireSuperAdmin();if(!allowed)return NextResponse.json({error:'Forbidden'},{status:403});
 const admin=createAdminClient();const {data,error}=await admin.from('discount_codes').select('*').order('created_at',{ascending:false});
 if(error)return NextResponse.json({error:error.message},{status:500});
 const rows=await Promise.all((data||[]).map(async d=>{const {count}=await admin.from('discount_redemptions').select('id',{count:'exact',head:true}).eq('discount_id',d.id);return {...d,used_count:count||0};}));
 return NextResponse.json({discounts:rows});
}

export async function POST(req:Request){
 const {user,allowed}=await requireSuperAdmin();if(!allowed||!user)return NextResponse.json({error:'Forbidden'},{status:403});
 if(!process.env.LEMON_SQUEEZY_API_KEY||!process.env.LEMON_SQUEEZY_STORE_ID)return NextResponse.json({error:'Lemon Squeezy billing is not configured.'},{status:503});
 let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 const code=String(b.code||'').trim().toUpperCase();const name=String(b.name||code).trim();const amountType=b.amountType==='fixed'?'fixed':'percent';const amount=Number(b.amount);
 const plans=Array.isArray(b.plans)?b.plans.filter((x:string)=>PLANS.includes(x as any)):[...PLANS];const intervals=Array.isArray(b.intervals)?b.intervals.filter((x:string)=>INTERVALS.includes(x as any)):[...INTERVALS];
 const duration=['once','repeating','forever'].includes(b.duration)?b.duration:'once';const durationMonths=duration==='repeating'?Number(b.durationMonths):null;const validDurationMonths=Number.isInteger(durationMonths)&&durationMonths>=1?durationMonths:null;
 const maxRedemptions=b.maxRedemptions===''||b.maxRedemptions==null?null:Number(b.maxRedemptions);const maxPerUser=b.maxRedemptionsPerUser===''||b.maxRedemptionsPerUser==null?null:Number(b.maxRedemptionsPerUser);
 const startsAt=b.startsAt?new Date(b.startsAt).toISOString():null;const expiresAt=b.expiresAt?new Date(b.expiresAt).toISOString():null;
 if(!/^[A-Z0-9]{3,64}$/.test(code)||!name)return NextResponse.json({error:'Invalid code or name.'},{status:400});
 if(!Number.isFinite(amount)||amount<=0||(amountType==='percent'&&amount>100))return NextResponse.json({error:'Invalid discount amount.'},{status:400});
 if(!plans.length||!intervals.length)return NextResponse.json({error:'Select at least one plan and interval.'},{status:400});
 if(duration==='repeating'&&validDurationMonths===null)return NextResponse.json({error:'Invalid repeating duration.'},{status:400});
 if(maxRedemptions!==null&&(!Number.isInteger(maxRedemptions)||maxRedemptions<1))return NextResponse.json({error:'Invalid redemption limit.'},{status:400});
 if(maxPerUser!==null&&(!Number.isInteger(maxPerUser)||maxPerUser<1))return NextResponse.json({error:'Invalid per-user limit.'},{status:400});
 if(startsAt&&expiresAt&&new Date(expiresAt)<=new Date(startsAt))return NextResponse.json({error:'Expiry must be after start.'},{status:400});
 const variants=variantIds(plans,intervals);const attrs:any={name,code,amount:amountType==='fixed'?Math.round(amount*100):amount,amount_type:amountType,is_limited_to_products:variants.length<6,is_limited_redemptions:maxRedemptions!==null,max_redemptions:maxRedemptions||0,starts_at:startsAt,expires_at:expiresAt,duration,duration_in_months:durationMonths||1};
 const ls=await fetch('https://api.lemonsqueezy.com/v1/discounts',{method:'POST',headers:headers(),body:JSON.stringify({data:{type:'discounts',attributes:attrs,relationships:{store:{data:{type:'stores',id:String(process.env.LEMON_SQUEEZY_STORE_ID)}},...(variants.length<6?{variants:{data:variants.map(id=>({type:'variants',id:String(id)}))}}:{})}}})});
 const lsBody=await ls.json().catch(()=>null);if(!ls.ok)return NextResponse.json({error:lsBody?.errors?.[0]?.detail||'Lemon Squeezy could not create the discount.'},{status:502});
 const lsId=String(lsBody?.data?.id||'');const admin=createAdminClient();const {data,error}=await admin.from('discount_codes').insert({code,name,amount_type:amountType,amount,currency:'USD',applies_to_plans:plans,applies_to_intervals:intervals,duration,duration_months:validDurationMonths,max_redemptions:maxRedemptions,max_redemptions_per_user:maxPerUser,starts_at:startsAt,expires_at:expiresAt,active:true,internal_note:String(b.internalNote||'').trim()||null,ls_discount_id:lsId,created_by:user.id}).select().single();
 if(error){await fetch('https://api.lemonsqueezy.com/v1/discounts/'+encodeURIComponent(lsId),{method:'DELETE',headers:headers()});return NextResponse.json({error:error.message},{status:500});}
 return NextResponse.json({discount:data},{status:201});
}

export async function PATCH(req:Request){
 const {allowed}=await requireSuperAdmin();if(!allowed)return NextResponse.json({error:'Forbidden'},{status:403});let b:any;try{b=await req.json()}catch{return NextResponse.json({error:'Invalid JSON.'},{status:400})}
 if(!b.id)return NextResponse.json({error:'Discount id is required.'},{status:400});const admin=createAdminClient();const {data:row}=await admin.from('discount_codes').select('id,ls_discount_id,active').eq('id',String(b.id)).maybeSingle();if(!row)return NextResponse.json({error:'Discount not found.'},{status:404});
 if(row.active){if(!process.env.LEMON_SQUEEZY_API_KEY)return NextResponse.json({error:'Billing not configured.'},{status:503});const ls=await fetch('https://api.lemonsqueezy.com/v1/discounts/'+encodeURIComponent(row.ls_discount_id),{method:'DELETE',headers:headers()});if(!ls.ok&&ls.status!==404)return NextResponse.json({error:'Could not disable the Lemon Squeezy discount.'},{status:502});}
 const {error}=await admin.from('discount_codes').update({active:false,updated_at:new Date().toISOString()}).eq('id',row.id);if(error)return NextResponse.json({error:error.message},{status:500});return NextResponse.json({ok:true});
}
