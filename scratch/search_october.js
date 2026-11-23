const fs = require('fs');
const path = require('path');

const brainDir = 'C:/Users/acedi/.gemini/antigravity-ide/brain';
const dirs = fs.readdirSync(brainDir);

const octoberDirs = dirs.filter(d => {
  try {
    const stat = fs.statSync(path.join(brainDir, d));
    return stat.isDirectory() && stat.mtime >= new Date('2026-10-01');
  } catch(e) { return false; }
});

console.log('October conversations:', octoberDirs.length);

for (const d of octoberDirs) {
  const p = path.join(brainDir, d, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(p)) continue;
  
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.includes('login') && (l.includes('local') || l.includes('host') || l.includes('fastpanel') || l.includes('vps') || l.includes('cors') || l.includes('nginx') || l.includes('works'))) {
      try {
        const j = JSON.parse(l);
        if (j.type === 'USER_INPUT') {
          console.log(`[${d.slice(0,8)}] Step ${j.step_index} USER: ${j.content.slice(0, 180).replace(/\n/g, ' ')}`);
        }
      } catch(e) {}
    }
  }
}
