const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
(async()=>{
  const r = await fetch('https://www.roblox.com/login',{headers:{'User-Agent':UA,'Accept-Language':'en-US,en;q=0.9'}});
  const html = await r.text();
  console.log('page',r.status,html.length);
  const urls = [...html.matchAll(/https:\/\/js\.rbxcdn\.com\/[^"'\s>]+/g)].map(m=>m[0]);
  const uniq=[...new Set(urls)];
  console.log('bundles',uniq.length);
  uniq.filter(u=>/Login|Authentication|TwoStep|Api|Core/i.test(u)).forEach(u=>console.log('  ',u));
})();
