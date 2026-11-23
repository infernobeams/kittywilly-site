const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const url='https://js.rbxcdn.com/ed0ccc34c63d8148924003c3e2cbabc7f2f4308a2fd01ec47494cef6ee2cdd59-ReactLogin.js';
(async()=>{
  const r=await fetch(url,{headers:{'User-Agent':UA}});
  const js=await r.text();
  require('fs').writeFileSync('scratch/ReactLogin.js',js);
  console.log('len',js.length);
  for (const needle of ['twoStepVerificationData','twoStepVerificationChallengeId','twoStepVerificationToken','secureAuthenticationIntent','verificationToken','challengeId','challenges/','actionType','twostepverification']) {
    const idxs=[]; let i=-1;
    while((i=js.indexOf(needle,i+1))!==-1 && idxs.length<6) idxs.push(i);
    console.log(needle, '->', idxs.length?idxs.join(','):'NONE');
  }
})();
