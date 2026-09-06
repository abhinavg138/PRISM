/**
 * PRISM Intervention Priority Queue — Deterministic Test Suite
 *
 * Tests the 5 mandated scenarios:
 *  1. High risk + high urgency
 *  2. High risk + low urgency
 *  3. Moderate risk + severe deterioration
 *  4. High risk + low evidence confidence
 *  5. Multiple simultaneous drivers
 */

import { PRISMPriorityEngine, calcScheduleUrgency, calcRecentDeterioration, priorityTierFromScore } from '../server/priorityEngine';
import { PRISMRiskEngine } from '../server/riskEngine';
import { PaimanaObservation } from '../src/types/index';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`TEST ASSERTION FAILED: ${message}`);
  }
}

console.log('=====================================================');
console.log('PRISM Priority Engine — Deterministic Test Suite');
console.log('=====================================================\n');

// -------------------------------------------------------------
// Test Case 1: High Risk + High Urgency
// -------------------------------------------------------------
console.log('--- Test Case 1: High Risk + High Urgency ---');
const case1Obs: PaimanaObservation[] = [
  { report_month: '2026-04', project_id: 'C1', project_name: 'Overdue Rail Corridor', agency: 'IR', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 1800, cumulative_expenditure_cr: 1700, physical_progress_pct: 70, original_target_completion_mm_yyyy: '12/2024', revised_target_completion_mm_yyyy: '05/2026' },
  { report_month: '2026-05', project_id: 'C1', project_name: 'Overdue Rail Corridor', agency: 'IR', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 1800, cumulative_expenditure_cr: 1720, physical_progress_pct: 70, original_target_completion_mm_yyyy: '12/2024', revised_target_completion_mm_yyyy: '05/2026' },
  { report_month: '2026-06', project_id: 'C1', project_name: 'Overdue Rail Corridor', agency: 'IR', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 1800, cumulative_expenditure_cr: 1750, physical_progress_pct: 70, original_target_completion_mm_yyyy: '12/2024', revised_target_completion_mm_yyyy: '05/2026' },
  { report_month: '2026-07', project_id: 'C1', project_name: 'Overdue Rail Corridor', agency: 'IR', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 1800, cumulative_expenditure_cr: 1770, physical_progress_pct: 70, original_target_completion_mm_yyyy: '12/2024', revised_target_completion_mm_yyyy: '05/2026' },
];

const priority1 = PRISMPriorityEngine.assess(case1Obs);
console.log(`Priority Score: ${priority1.priorityScore}, Tier: ${priority1.priorityTier}`);
console.log(`Risk Score: ${priority1.riskScore}, Urgency: ${priority1.urgency}, Deterioration: ${priority1.recentDeterioration}`);
console.log(`Action: ${priority1.recommendedAction}`);

assert(priority1.priorityScore >= 70, 'Case 1 must yield Priority Score >= 70');
assert(priority1.priorityTier === 'P1', 'Case 1 must be categorized as P1 (Immediate Intervention)');
assert(priority1.urgency >= 80, 'Case 1 must exhibit high schedule urgency (>= 80)');
assert(priority1.recommendedAction.includes('Review completion recovery plan'), 'Case 1 action must address schedule recovery');
console.log('✓ Test Case 1 Passed: High risk + high urgency triggers P1 Immediate Intervention.\n');


// -------------------------------------------------------------
// Test Case 2: High Risk + Low Urgency
// (High cost overrun & stagnation, but deadline is 6 years out)
// -------------------------------------------------------------
console.log('--- Test Case 2: High Risk + Low Urgency ---');
const case2Obs: PaimanaObservation[] = [
  { report_month: '2026-04', project_id: 'C2', project_name: 'Future Mega Port', agency: 'IPA', state: 'GJ', original_cost_cr: 5000, revised_cost_cr: 8000, cumulative_expenditure_cr: 2000, physical_progress_pct: 20, original_target_completion_mm_yyyy: '12/2032', revised_target_completion_mm_yyyy: '12/2032' },
  { report_month: '2026-05', project_id: 'C2', project_name: 'Future Mega Port', agency: 'IPA', state: 'GJ', original_cost_cr: 5000, revised_cost_cr: 8000, cumulative_expenditure_cr: 2050, physical_progress_pct: 20, original_target_completion_mm_yyyy: '12/2032', revised_target_completion_mm_yyyy: '12/2032' },
  { report_month: '2026-06', project_id: 'C2', project_name: 'Future Mega Port', agency: 'IPA', state: 'GJ', original_cost_cr: 5000, revised_cost_cr: 8000, cumulative_expenditure_cr: 2100, physical_progress_pct: 20.2, original_target_completion_mm_yyyy: '12/2032', revised_target_completion_mm_yyyy: '12/2032' },
  { report_month: '2026-07', project_id: 'C2', project_name: 'Future Mega Port', agency: 'IPA', state: 'GJ', original_cost_cr: 5000, revised_cost_cr: 8000, cumulative_expenditure_cr: 2150, physical_progress_pct: 20.3, original_target_completion_mm_yyyy: '12/2032', revised_target_completion_mm_yyyy: '12/2032' },
];

const priority2 = PRISMPriorityEngine.assess(case2Obs);
console.log(`Priority Score: ${priority2.priorityScore}, Tier: ${priority2.priorityTier}`);
console.log(`Risk Score: ${priority2.riskScore}, Urgency: ${priority2.urgency}, Deterioration: ${priority2.recentDeterioration}`);

assert(priority2.urgency <= 25, 'Case 2 urgency must be low (<= 25) due to 2032 target date');
assert(priority2.priorityScore < priority1.priorityScore, 'Case 2 priorityScore must be substantially lower than Case 1');
assert(priority2.priorityTier !== 'P1', 'Case 2 must NOT be in P1 tier despite having substantial risk');
console.log('✓ Test Case 2 Passed: High risk with distant deadline does NOT displace urgent interventions.\n');


// -------------------------------------------------------------
// Test Case 3: Moderate Risk + Severe Deterioration
// (Moderate baseline risk, but progress completely stalled in recent window)
// -------------------------------------------------------------
console.log('--- Test Case 3: Moderate Risk + Severe Deterioration ---');
const case3Obs: PaimanaObservation[] = [
  { report_month: '2026-04', project_id: 'C3', project_name: 'Mid-Stage Highway', agency: 'NHAI', state: 'UP', original_cost_cr: 1000, revised_cost_cr: 1050, cumulative_expenditure_cr: 500, physical_progress_pct: 50, original_target_completion_mm_yyyy: '10/2026', revised_target_completion_mm_yyyy: '10/2026' },
  { report_month: '2026-05', project_id: 'C3', project_name: 'Mid-Stage Highway', agency: 'NHAI', state: 'UP', original_cost_cr: 1000, revised_cost_cr: 1050, cumulative_expenditure_cr: 510, physical_progress_pct: 50, original_target_completion_mm_yyyy: '10/2026', revised_target_completion_mm_yyyy: '10/2026' },
  { report_month: '2026-06', project_id: 'C3', project_name: 'Mid-Stage Highway', agency: 'NHAI', state: 'UP', original_cost_cr: 1000, revised_cost_cr: 1050, cumulative_expenditure_cr: 520, physical_progress_pct: 50, original_target_completion_mm_yyyy: '10/2026', revised_target_completion_mm_yyyy: '10/2026' },
  { report_month: '2026-07', project_id: 'C3', project_name: 'Mid-Stage Highway', agency: 'NHAI', state: 'UP', original_cost_cr: 1000, revised_cost_cr: 1050, cumulative_expenditure_cr: 530, physical_progress_pct: 50, original_target_completion_mm_yyyy: '10/2026', revised_target_completion_mm_yyyy: '10/2026' },
];

const priority3 = PRISMPriorityEngine.assess(case3Obs);
console.log(`Priority Score: ${priority3.priorityScore}, Tier: ${priority3.priorityTier}`);
console.log(`Risk Score: ${priority3.riskScore}, Urgency: ${priority3.urgency}, Deterioration: ${priority3.recentDeterioration}`);
console.log(`Action: ${priority3.recommendedAction}`);

assert(priority3.recentDeterioration >= 80, 'Case 3 must have severe deterioration (>= 80) due to 3 consecutive stalled months');
assert(priority3.priorityScore >= 70, 'Case 3 must be boosted into P1 tier due to acute stagnation near deadline');
assert(priority3.recommendedAction.includes('Escalate physical-progress review'), 'Case 3 action must escalate physical-progress review');
console.log('✓ Test Case 3 Passed: Moderate risk with acute stagnation correctly elevated to P1.\n');


// -------------------------------------------------------------
// Test Case 4: High Risk + Low Evidence Confidence
// (Single snapshot vs 4 full monthly snapshots)
// -------------------------------------------------------------
console.log('--- Test Case 4: High Risk + Low Evidence Confidence ---');
const singleObs: PaimanaObservation[] = [
  { report_month: '2026-07', project_id: 'C4', project_name: 'Unverified Bridge', agency: 'PWD', state: 'BR', original_cost_cr: 500, revised_cost_cr: 900, cumulative_expenditure_cr: 800, physical_progress_pct: 40, original_target_completion_mm_yyyy: '12/2025', revised_target_completion_mm_yyyy: '08/2026' }
];

const multiObs: PaimanaObservation[] = [
  { report_month: '2026-04', project_id: 'C4', project_name: 'Unverified Bridge', agency: 'PWD', state: 'BR', original_cost_cr: 500, revised_cost_cr: 900, cumulative_expenditure_cr: 750, physical_progress_pct: 40, original_target_completion_mm_yyyy: '12/2025', revised_target_completion_mm_yyyy: '08/2026' },
  { report_month: '2026-05', project_id: 'C4', project_name: 'Unverified Bridge', agency: 'PWD', state: 'BR', original_cost_cr: 500, revised_cost_cr: 900, cumulative_expenditure_cr: 770, physical_progress_pct: 40, original_target_completion_mm_yyyy: '12/2025', revised_target_completion_mm_yyyy: '08/2026' },
  { report_month: '2026-06', project_id: 'C4', project_name: 'Unverified Bridge', agency: 'PWD', state: 'BR', original_cost_cr: 500, revised_cost_cr: 900, cumulative_expenditure_cr: 790, physical_progress_pct: 40, original_target_completion_mm_yyyy: '12/2025', revised_target_completion_mm_yyyy: '08/2026' },
  { report_month: '2026-07', project_id: 'C4', project_name: 'Unverified Bridge', agency: 'PWD', state: 'BR', original_cost_cr: 500, revised_cost_cr: 900, cumulative_expenditure_cr: 800, physical_progress_pct: 40, original_target_completion_mm_yyyy: '12/2025', revised_target_completion_mm_yyyy: '08/2026' }
];

const prioritySingle = PRISMPriorityEngine.assess(singleObs);
const priorityMulti = PRISMPriorityEngine.assess(multiObs);

console.log(`Single-obs confidence: ${prioritySingle.evidenceConfidence}, Priority Score: ${prioritySingle.priorityScore}`);
console.log(`Multi-obs confidence: ${priorityMulti.evidenceConfidence}, Priority Score: ${priorityMulti.priorityScore}`);

assert(prioritySingle.evidenceConfidence === 0.25, 'Single obs confidence must be 0.25');
assert(priorityMulti.evidenceConfidence === 1.0, '4-obs confidence must be 1.0');
assert(prioritySingle.priorityScore < priorityMulti.priorityScore, 'Single-obs project priority score must be discounted relative to multi-obs');
console.log('✓ Test Case 4 Passed: Low evidence confidence discounts priority score appropriately.\n');


// -------------------------------------------------------------
// Test Case 5: Multiple Simultaneous Drivers
// (Stagnation + Cost Overrun + Overdue + Spend Divergence)
// -------------------------------------------------------------
console.log('--- Test Case 5: Multiple Simultaneous Drivers ---');
const case5Obs: PaimanaObservation[] = [
  { report_month: '2026-04', project_id: 'C5', project_name: 'Compound Crisis Metro', agency: 'DMRC', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 2500, cumulative_expenditure_cr: 2400, physical_progress_pct: 45, original_target_completion_mm_yyyy: '01/2025', revised_target_completion_mm_yyyy: '03/2026' },
  { report_month: '2026-05', project_id: 'C5', project_name: 'Compound Crisis Metro', agency: 'DMRC', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 2500, cumulative_expenditure_cr: 2420, physical_progress_pct: 45, original_target_completion_mm_yyyy: '01/2025', revised_target_completion_mm_yyyy: '03/2026' },
  { report_month: '2026-06', project_id: 'C5', project_name: 'Compound Crisis Metro', agency: 'DMRC', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 2500, cumulative_expenditure_cr: 2440, physical_progress_pct: 45, original_target_completion_mm_yyyy: '01/2025', revised_target_completion_mm_yyyy: '03/2026' },
  { report_month: '2026-07', project_id: 'C5', project_name: 'Compound Crisis Metro', agency: 'DMRC', state: 'DL', original_cost_cr: 1000, revised_cost_cr: 2500, cumulative_expenditure_cr: 2460, physical_progress_pct: 45, original_target_completion_mm_yyyy: '01/2025', revised_target_completion_mm_yyyy: '03/2026' },
];

const priority5 = PRISMPriorityEngine.assess(case5Obs);
console.log(`Priority Score: ${priority5.priorityScore}, Tier: ${priority5.priorityTier}`);
console.log(`Top Drivers: ${priority5.topRiskDrivers.join(', ')}`);
console.log(`Combined Recommended Action: ${priority5.recommendedAction}`);

assert(priority5.priorityTier === 'P1', 'Case 5 must be P1');
assert(priority5.priorityScore >= 85, 'Case 5 priority score must be >= 85');
assert(priority5.recommendedAction.includes('Escalate physical-progress review'), 'Must include progress escalation');
assert(priority5.recommendedAction.includes('Review completion recovery plan'), 'Must include recovery plan review');
assert(priority5.recommendedAction.includes('Initiate cost/revision review'), 'Must include cost review');
assert(priority5.recommendedAction.includes('Review expenditure–physical progress divergence'), 'Must include divergence review');
console.log('✓ Test Case 5 Passed: Multiple concurrent drivers generate combined actionable interventions.\n');

console.log('=====================================================');
console.log('ALL 5 DETERMINISTIC PRIORITY ENGINE TESTS PASSED!');
console.log('=====================================================\n');
