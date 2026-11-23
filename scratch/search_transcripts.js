const fs = require('fs');
const convs = ['40762134-8ed6-43a1-ac1e-0f4cd9ac5641', '0f0fc623-9c03-43ae-9314-7692aa77d069', '24bbfd60-d531-4915-9399-a8a70733ec96'];
convs.forEach(c => {
  const p = 'C:/Users/acedi/.gemini/antigravity-ide/brain/' + c + '/.system_generated/logs/transcript.jsonl';
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  lines.forEach((l) => {
    if ((l.includes('local') || l.includes('host') || l.includes('work')) && (l.includes('login') || l.includes('auth'))) {
      try {
        const j = JSON.parse(l);
        if (j.type === 'USER_INPUT') {
          console.log(`[${c.slice(0,8)}] Step ${j.step_index} USER:`, (j.content || '').slice(0, 200).replace(/\n/g, ' '));
        }
      } catch(e){}
    }
  });
});
