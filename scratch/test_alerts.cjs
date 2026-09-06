const http = require('http');

http.get('http://localhost:3000/api/projects?limit=3000', res => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const json = JSON.parse(data);
    const projects = json.projects;
    const alerts = [];
    
    for (const p of projects) {
      const trend = p.monthlyTrend || [];
      const len = trend.length;
      
      // 1. Progress Stagnation: check consecutive monthly deltas <= 0.2
      if (len >= 2) {
        const last = trend[len - 1];
        const prev = trend[len - 2];
        const delta = (last.actualPercent ?? 0) - (prev.actualPercent ?? 0);
        
        let consecutiveStagnant = 0;
        for (let i = len - 1; i >= 1; i--) {
          const d = (trend[i].actualPercent ?? 0) - (trend[i-1].actualPercent ?? 0);
          if (Math.abs(d) <= 0.2) consecutiveStagnant++;
          else break;
        }
        
        if (consecutiveStagnant >= 2 && (p.physicalProgressPercent < 95)) {
          const periodStr = `${prev.month || prev.reportMonth} – ${last.month || last.reportMonth}`;
          alerts.push({
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code,
            state: p.state,
            sector: p.derivedSector || p.sector,
            alertType: 'Progress Stagnation',
            severity: consecutiveStagnant >= 3 ? 'CRITICAL' : 'HIGH',
            detectedPeriod: periodStr,
            evidence: `Physical progress changed by only ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} percentage points across ${consecutiveStagnant} consecutive reporting cycles (${trend[len - 1 - consecutiveStagnant]?.actualPercent ?? prev.actualPercent}% to ${last.actualPercent}%).`,
            recommendedAttention: 'Conduct site execution review and contractor physical mobilization audit.',
            riskScore: p.riskScore,
            priorityScore: p.priorityScore
          });
          continue;
        }
      }

      // 2. High/Critical Risk
      if (p.riskScore != null && p.riskScore >= 80) {
        alerts.push({
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          state: p.state,
          sector: p.derivedSector || p.sector,
          alertType: 'High/Critical Risk',
          severity: 'CRITICAL',
          detectedPeriod: p.lastUpdated || 'July 2026',
          evidence: `Composite PRISM Risk Index reached ${p.riskScore}/100 (${p.riskTier}) with confirmed multi-indicator operational strain.`,
          recommendedAttention: 'Escalate to Ministry Project Monitoring Cell for executive priority oversight.',
          riskScore: p.riskScore,
          priorityScore: p.priorityScore
        });
        continue;
      }

      // 3. Physical-Financial Divergence
      const expPct = p.expenditurePctOfRevisedCost ?? (p.revisedCostCr > 0 ? (p.cumulativeExpenditureCr / p.revisedCostCr) * 100 : 0);
      const physPct = p.physicalProgressPercent ?? 0;
      const gap = expPct - physPct;
      if (gap >= 20 && p.cumulativeExpenditureCr > 10) {
        alerts.push({
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          state: p.state,
          sector: p.derivedSector || p.sector,
          alertType: 'Physical-Financial Divergence',
          severity: gap >= 35 ? 'CRITICAL' : 'HIGH',
          detectedPeriod: p.lastUpdated || 'July 2026',
          evidence: `Cumulative expenditure reached ${expPct.toFixed(1)}% of revised cost while physical completion is ${physPct.toFixed(1)}% (${gap.toFixed(1)} pp divergence gap).`,
          recommendedAttention: 'Audit milestone-linked disbursement vouchers and verify contractor payment clearances.',
          riskScore: p.riskScore,
          priorityScore: p.priorityScore
        });
        continue;
      }

      // 4. Cost Escalation
      if (p.costOverrunPercent >= 40 && p.originalCostCr > 10) {
        alerts.push({
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          state: p.state,
          sector: p.derivedSector || p.sector,
          alertType: 'Cost Escalation',
          severity: p.costOverrunPercent >= 80 ? 'CRITICAL' : 'HIGH',
          detectedPeriod: p.lastUpdated || 'July 2026',
          evidence: `Sanctioned cost increased by ${p.costOverrunPercent.toFixed(1)}% from ₹${p.originalCostCr.toLocaleString()} Cr original outlay to ₹${p.revisedCostCr.toLocaleString()} Cr revised outlay.`,
          recommendedAttention: 'Initiate Expenditure Finance Committee (EFC) revised cost sanction review.',
          riskScore: p.riskScore,
          priorityScore: p.priorityScore
        });
        continue;
      }

      // 5. Schedule Pressure
      if ((p.urgency || 0) >= 85 && p.physicalProgressPercent < 90) {
        alerts.push({
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          state: p.state,
          sector: p.derivedSector || p.sector,
          alertType: 'Schedule Pressure',
          severity: 'HIGH',
          detectedPeriod: p.lastUpdated || 'July 2026',
          evidence: `Target completion (${p.revisedCompletionDate || p.originalCompletionDate}) indicates critical schedule pressure with ${(100 - p.physicalProgressPercent).toFixed(1)}% work remaining.`,
          recommendedAttention: 'Convene inter-agency taskforce to finalize revised critical path recovery plan.',
          riskScore: p.riskScore,
          priorityScore: p.priorityScore
        });
        continue;
      }

      // 6. Deteriorating Progress
      if (len >= 3) {
        const deltas = [];
        for (let i = 1; i < len; i++) {
          deltas.push((trend[i].actualPercent ?? 0) - (trend[i-1].actualPercent ?? 0));
        }
        const recentDelta = deltas[deltas.length - 1];
        const earlyAvg = deltas.slice(0, -1).reduce((a,b)=>a+b,0) / (deltas.length - 1);
        if (earlyAvg >= 1.0 && (earlyAvg - recentDelta) >= 1.5) {
          alerts.push({
            projectId: p.id,
            projectName: p.name,
            projectCode: p.code,
            state: p.state,
            sector: p.derivedSector || p.sector,
            alertType: 'Deteriorating Progress',
            severity: recentDelta <= 0 ? 'HIGH' : 'MEDIUM',
            detectedPeriod: `${trend[len-1].month || trend[len-1].reportMonth}`,
            evidence: `Monthly progress pace decelerated from earlier ${earlyAvg.toFixed(1)} pp/mo to ${recentDelta.toFixed(1)} pp/mo in ${trend[len-1].month || trend[len-1].reportMonth}.`,
            recommendedAttention: 'Investigate work front bottlenecks and verify field measurement certification.',
            riskScore: p.riskScore,
            priorityScore: p.priorityScore
          });
        }
      }
    }

    console.log('Total alerts generated:', alerts.length);
    const byType = {};
    const bySev = {};
    for (const a of alerts) {
      byType[a.alertType] = (byType[a.alertType] || 0) + 1;
      bySev[a.severity] = (bySev[a.severity] || 0) + 1;
    }
    console.log('By Type:', byType);
    console.log('By Severity:', bySev);
    console.log('\nFirst 3 alerts:\n', JSON.stringify(alerts.slice(0, 3), null, 2));
  });
});
