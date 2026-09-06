const http = require('http');

const questions = [
  { message: "Which projects have the highest risk?" },
  { message: "How many projects are in Odisha?" },
  { message: "Which sector has the highest average risk?" },
  { message: "Why is project 701396 high risk?" },
  { message: "Which projects show stagnant progress?" },
  { message: "Calculate the risk yourself" },
  { message: "How many projects are being monitored?" },
  { message: "Which projects need attention first?" },
  { message: "How has this project's progress changed since April?", activeProjectId: "701396" }
];

async function ask(q) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(q);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/copilot/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runAll() {
  console.log('=====================================================');
  console.log('PRISM Grounded Copilot Test Suite');
  console.log('=====================================================\n');

  for (const q of questions) {
    console.log(`\n-----------------------------------------------------`);
    console.log(`Q: "${q.message}" ${q.activeProjectId ? `(activeProject: ${q.activeProjectId})` : ''}`);
    console.log(`-----------------------------------------------------`);
    try {
      const res = await ask(q);
      console.log(`A:\n${res.answer}`);
      console.log(`\nGrounded Projects (${res.groundedProjects?.length || 0}):`, res.groundedProjects?.map(p => `${p.id} (${p.name}): ${p.riskScore} [${p.riskTier}]`));
      console.log(`Suggested Questions:`, res.suggestedQuestions);
    } catch (err) {
      console.error('FAILED:', err);
    }
  }
}

runAll();
