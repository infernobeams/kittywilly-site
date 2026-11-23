const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const jar=new Map();
function absorb(res){const l=res.headers.getSetCookie?res.headers.getSetCookie():[];for(const r of l){const p=r.split(';')[0];const i=p.indexOf('=');if(i>0)jar.set(p.slice(0,i).trim(),p.slice(i+1).trim());}return l;}
const cookieHeader=()=>[...jar.entries()].map(([k,v])=>`${k}=${v}`).join('; ');
async function post(url,body,csrf){const h={'User-Agent':UA,'Content-Type':'application/json',Accept:'application/json, text/plain, */*',Origin:'https://www.roblox.com',Referer:'https://www.roblox.com/login',Cookie:cookieHeader()};if(csrf)h['X-CSRF-TOKEN']=csrf;const r=await fetch(url,{method:'POST',headers:h,body:JSON.stringify(body),redirect:'manual'});const sc=absorb(r);return {r,sc};}
(async()=>{
  const creds={ctype:'Username',cvalue:'indefinitetesting',password:'charizardx'};
  let {r}=await post('https://auth.roblox.com/v2/login',creds,null);
  let csrf=r.headers.get('x-csrf-token'); console.log('1st status',r.status,'csrf?',!!csrf);
  if(!csrf){const h=await fetch('https://auth.roblox.com/v2/login',{method:'POST',headers:{'User-Agent':UA,'Content-Type':'application/json',Cookie:cookieHeader()},body:'{}'});csrf=h.headers.get('x-csrf-token');absorb(h);console.log('primed csrf?',!!csrf);}
  const out=await post('https://auth.roblox.com/v2/login',creds,csrf);
  r=out.r;
  console.log('2nd status',r.status);
  console.log('challenge-type',r.headers.get('rblx-challenge-type'));
  console.log('set-cookie raws:');out.sc.forEach(c=>console.log('  RAW:',JSON.stringify(c.slice(0,140))));
  console.log('jar keys:',[...jar.keys()]);
  const txt=await r.text();console.log('body head:',txt.slice(0,200));
})();
