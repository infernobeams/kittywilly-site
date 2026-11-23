const fs = require('fs');
const path = require('path');

function inspectConv(id) {
  const p = path.join('C:/Users/acedi/.gemini/antigravity-ide/brain', id, '.system_generated/logs/transcript.jsonl');
  if (!fs.existsSync(p)) return;
  const lines = fs.readFileSync(p, 'utf8').split('\n');
  console.log(`=== CONVERSATION ${id} (${lines.length} lines) ===`);
  lines.forEach((l) => {
    try {
      const j = JSON.parse(l);
      if (j.type === 'USER_INPUT') {
        console.log(`\n--- USER (Step ${j.step_index}) ---: ${j.content.slice(0, 300)}`);
      } else if (j.type === 'PLANNER_RESPONSE' && j.content && j.content.length > 50) {
        console.log(`--- ASSISTANT (Step ${j.step_index}) ---: ${j.content.slice(0, 400)}...\n`);
      }
    } catch(e) {}
  });
}

inspectConv('580aa64e-3761-4bd2-a712-0434f0d9b163');
inspectConv('c47390a1-9d65-4668-9fb5-f30dce3def12');
