const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
(async()=>{
  const r = await fetch('https://apis.roblox.com/hba-service/v1/getServerNonce',{headers:{'User-Agent':UA,Accept:'application/json, text/plain, */*',Origin:'https://www.roblox.com',Referer:'https://www.roblox.com/login'}});
  console.log('status',r.status);
  const t = await r.text();
  console.log('body raw:', t.slice(0,300));
  console.log('ctype:', r.headers.get('content-type'));
})();
