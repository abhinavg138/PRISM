const http = require('http');

http.get('http://localhost:3000/api/analytics', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('KPIs:', JSON.stringify(json.kpis, null, 2));
    
    // Now let's fetch /api/projects?limit=3000
    http.get('http://localhost:3000/api/projects?limit=3000', (res2) => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        const pJson = JSON.parse(data2);
        const projects = pJson.projects;
        console.log('Total projects fetched:', projects.length);
        
        let counts = { CRITICAL: 0, HIGH: 0, MODERATE: 0, LOW: 0, UNRATED: 0, OTHER: 0 };
        let mismatches = [];
        
        for (const p of projects) {
          const score = p.riskScore;
          const tier = p.riskTier;
          
          if (counts[tier] !== undefined) counts[tier]++;
          else counts.OTHER++;
          
          let expectedTier = 'UNRATED';
          if (score != null) {
            if (score >= 80) expectedTier = 'CRITICAL';
            else if (score >= 60) expectedTier = 'HIGH';
            else if (score >= 40) expectedTier = 'MODERATE';
            else expectedTier = 'LOW';
          }
          
          if (tier !== expectedTier) {
            mismatches.push({ id: p.id, name: p.name, score, tier, expectedTier });
          }
        }
        
        console.log('Tier distribution in projects:', counts);
        console.log('Sum of tiers:', Object.values(counts).reduce((a, b) => a + b, 0));
        console.log('Mismatches between score and tier:', mismatches.length);
        if (mismatches.length > 0) {
          console.log('First 5 mismatches:', mismatches.slice(0, 5));
        }
      });
    });
  });
});
