import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { Project, PaimanaObservation, PortfolioKPIs, RiskTier, PriorityTier, SectorStat, EarlyWarningAlert, AlertType, AlertSeverity } from '../src/types/index';
import { PRISMRiskEngine, RiskAssessment } from './riskEngine';
import { PRISMPriorityEngine, PriorityAssessment } from './priorityEngine';
import { PRISMAlertEngine } from './alertEngine';

export interface PaimanaFilterOptions {
  search?: string;
  state?: string;
  agency?: string;
  sector?: string;
  riskTier?: string;
  priorityTier?: string;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface PaimanaRepositoryStats {
  totalObservations: number;
  uniqueProjects: number;
  projectsWith4Months: number;
  projectsMissingCoordinates: number;
  projectsUnrated: number;
  reportMonths: string[];
}

/**
 * Internal helper to derive infrastructure sector from agency and project name.
 * Labeled internally as derived classification; NOT an official PAIMANA field.
 */
export function deriveSectorFromAgency(agency: string = '', projectName: string = ''): string {
  const text = `${agency} ${projectName}`.toLowerCase();
  if (/railway|rail|rly|krcl|irctc|rvnl|dfccil/.test(text)) return 'Railways';
  if (/road|highway|nhai|morth|pwd|expressway|bridge/.test(text)) return 'Road Transport & Highways';
  if (/power|ntpc|powergrid|electricity|energy|dvc|solar|wind|hydro|nhpc|sjvn|neepco/.test(text)) return 'Power & Energy';
  if (/petroleum|gas|iocl|ongc|bpcl|hpcl|gail|oil|refinery|pipeline/.test(text)) return 'Petroleum & Gas';
  if (/metro|urban|smart city|housing|delhi metro|bangalore metro|maha metro|mmrda|crda/.test(text)) return 'Urban Affairs & Metro';
  if (/port|shipping|inland water|sagarmala|maritime|shipyard|dock/.test(text)) return 'Ports & Shipping';
  if (/telecom|dot|bharatnet|bsnl|bbnl|broadband|optical fibre/.test(text)) return 'Telecommunications';
  if (/coal|cil|mines|mining|ecl|wcl|ccl|bccl|secl|ncl|mcl|singareni/.test(text)) return 'Coal & Mining';
  if (/airport|aai|aviation/.test(text)) return 'Civil Aviation';
  if (/water|irrigation|dam|narmada|canal/.test(text)) return 'Water Resources';
  if (/steel|sail|rinl|metallurg|iron/.test(text)) return 'Steel & Heavy Industry';
  return 'Other Infrastructure';
}

function parseMmYyyy(str?: string): { month: number; year: number } | null {
  if (!str || typeof str !== 'string') return null;
  const parts = str.trim().split('/');
  if (parts.length !== 2) return null;
  const m = parseInt(parts[0], 10);
  const y = parseInt(parts[1], 10);
  if (isNaN(m) || isNaN(y)) return null;
  return { month: m, year: y };
}

function calcMonthDifference(origStr?: string, revStr?: string): number {
  const orig = parseMmYyyy(origStr);
  const rev = parseMmYyyy(revStr);
  if (!orig || !rev) return 0;
  const diff = (rev.year - orig.year) * 12 + (rev.month - orig.month);
  return Math.max(0, diff);
}

const MONTH_DISPLAY_MAP: Record<string, string> = {
  '2026-04': 'Apr 2026',
  '2026-05': 'May 2026',
  '2026-06': 'Jun 2026',
  '2026-07': 'Jul 2026'
};

export class PaimanaRepository {
  private observations: PaimanaObservation[] = [];
  private projectsMap: Map<string, Project> = new Map();
  private projectObservationsMap: Map<string, PaimanaObservation[]> = new Map();
  /** Risk assessments keyed by project_id — computed once at load time */
  private riskAssessmentsMap: Map<string, RiskAssessment> = new Map();
  /** Priority assessments keyed by project_id — computed once at load time (Phase 3A) */
  private priorityAssessmentsMap: Map<string, PriorityAssessment> = new Map();
  /** Early warning alerts keyed by project_id */
  private alertsMap: Map<string, EarlyWarningAlert> = new Map();
  private alertsList: EarlyWarningAlert[] = [];
  private statesSet: Set<string> = new Set();
  private agenciesSet: Set<string> = new Set();
  private sectorsSet: Set<string> = new Set();
  private monthsSet: Set<string> = new Set();
  private isLoaded: boolean = false;

  constructor(
    private excelPath: string = path.join(process.cwd(), 'data', 'PRISM_PAIMANA_Dataset_v1_Apr-Jul_2026.xlsx'),
    private csvPath: string = path.join(process.cwd(), 'data', 'PRISM_ML_features_v1.csv')
  ) {}

  public load(): void {
    if (this.isLoaded) return;

    let loadedRows: any[] = [];

    // Primary attempt: Load from Excel workbook
    if (fs.existsSync(this.excelPath)) {
      try {
        console.log(`[PaimanaRepository] Loading primary dataset from Excel: ${this.excelPath}`);
        const workbook = XLSX.readFile(this.excelPath);
        const sheetName = workbook.SheetNames.includes('project_snapshots')
          ? 'project_snapshots'
          : workbook.SheetNames[0];
        loadedRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        console.log(`[PaimanaRepository] Loaded ${loadedRows.length} snapshot rows from Excel sheet "${sheetName}".`);
      } catch (err) {
        console.warn(`[PaimanaRepository] Failed to read Excel workbook, trying CSV:`, err);
      }
    }

    // Fallback or supplementary: Load CSV if Excel yielded no rows
    if (loadedRows.length === 0 && fs.existsSync(this.csvPath)) {
      try {
        console.log(`[PaimanaRepository] Loading dataset from CSV: ${this.csvPath}`);
        const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
        const workbook = XLSX.read(csvContent, { type: 'string' });
        loadedRows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        console.log(`[PaimanaRepository] Loaded ${loadedRows.length} snapshot rows from CSV.`);
      } catch (csvErr) {
        console.error(`[PaimanaRepository] Error loading CSV data:`, csvErr);
      }
    }

    if (loadedRows.length === 0) {
      throw new Error(`[PaimanaRepository] Could not load PAIMANA dataset from ${this.excelPath} or ${this.csvPath}`);
    }

    this.observations = loadedRows.map((r: any) => {
      const origCost = parseFloat(r.original_cost_cr) || 0;
      const revCost = parseFloat(r.revised_cost_cr) || origCost;
      const cumExp = parseFloat(r.cumulative_expenditure_cr) || 0;
      const physProg = parseFloat(r.physical_progress_pct) || 0;
      const expPct = r.expenditure_pct_of_revised_cost != null
        ? parseFloat(r.expenditure_pct_of_revised_cost)
        : (revCost > 0 ? parseFloat(((cumExp / revCost) * 100).toFixed(2)) : 0);

      const obs: PaimanaObservation = {
        report_month: String(r.report_month || '').trim(),
        report_page: r.report_page,
        row_no: r.row_no,
        project_id: String(r.project_id || '').trim(),
        project_name: String(r.project_name || '').trim(),
        agency: String(r.agency || '').trim(),
        legacy_ocms_code: r.legacy_ocms_code ? String(r.legacy_ocms_code).trim() : undefined,
        pmgid: r.pmgid ? String(r.pmgid).trim() : undefined,
        state: String(r.state || '').trim(),
        approval_start_mm_yyyy: r.approval_start_mm_yyyy ? String(r.approval_start_mm_yyyy).trim() : undefined,
        revised_start_mm_yyyy: r.revised_start_mm_yyyy ? String(r.revised_start_mm_yyyy).trim() : undefined,
        original_target_completion_mm_yyyy: r.original_target_completion_mm_yyyy ? String(r.original_target_completion_mm_yyyy).trim() : undefined,
        revised_target_completion_mm_yyyy: r.revised_target_completion_mm_yyyy ? String(r.revised_target_completion_mm_yyyy).trim() : undefined,
        original_cost_cr: origCost,
        revised_cost_cr: revCost,
        cumulative_expenditure_cr: cumExp,
        physical_progress_pct: physProg,
        source: r.source,
        source_file: r.source_file,
        expenditure_pct_of_revised_cost: expPct,
        cost_revision_pct: parseFloat(r.cost_revision_pct) || 0,
        physical_progress_change_mom_pct_points: parseFloat(r.physical_progress_change_mom_pct_points) || 0,
        expenditure_change_mom_cr: parseFloat(r.expenditure_change_mom_cr) || 0,
        revised_cost_change_mom_cr: parseFloat(r.revised_cost_change_mom_cr) || 0,
        progress_change: parseFloat(r.progress_change) || 0,
        expenditure_change: parseFloat(r.expenditure_change) || 0,
        expenditure_pct: parseFloat(r.expenditure_pct) || expPct,
        progress_expenditure_gap: parseFloat(r.progress_expenditure_gap) || (physProg - expPct)
      };

      if (obs.report_month) this.monthsSet.add(obs.report_month);
      if (obs.state) this.statesSet.add(obs.state);
      if (obs.agency) this.agenciesSet.add(obs.agency);

      return obs;
    });

    // Group observations by project_id
    this.projectObservationsMap.clear();
    for (const obs of this.observations) {
      if (!obs.project_id) continue;
      if (!this.projectObservationsMap.has(obs.project_id)) {
        this.projectObservationsMap.set(obs.project_id, []);
      }
      this.projectObservationsMap.get(obs.project_id)!.push(obs);
    }

    // Sort observations for each project chronologically by report_month
    for (const [pid, obsList] of this.projectObservationsMap.entries()) {
      obsList.sort((a, b) => a.report_month.localeCompare(b.report_month));
    }

    // Build project representations based on latest available monthly observation
    this.projectsMap.clear();
    this.sectorsSet.clear();

    for (const [pid, obsList] of this.projectObservationsMap.entries()) {
      const latest = obsList[obsList.length - 1];
      const derivedSector = deriveSectorFromAgency(latest.agency, latest.project_name);
      this.sectorsSet.add(derivedSector);

      // S-curve timeline data points for all available months (April, May, June, July 2026)
      const monthlyTrend = obsList.map(o => ({
        month: MONTH_DISPLAY_MAP[o.report_month] || o.report_month,
        reportMonth: o.report_month,
        plannedPercent: null, // Zero fabrication: planned percent is not reported in PAIMANA flash reports
        actualPercent: o.physical_progress_pct,
        financialExpenditureCr: o.cumulative_expenditure_cr,
        expenditurePctOfRevisedCost: o.expenditure_pct_of_revised_cost
      }));

      // Official PAIMANA MoSPI flash report timeline audit trail
      const auditTrail = obsList.map((o, idx) => ({
        id: `aud-${pid}-${o.report_month}`,
        date: o.report_month,
        event: `PAIMANA Central Flash Report (${MONTH_DISPLAY_MAP[o.report_month] || o.report_month}): Physical progress recorded at ${o.physical_progress_pct}%, cumulative spend ₹${o.cumulative_expenditure_cr} Cr.`,
        reportedBy: o.source || 'PAIMANA Central Flash Report',
        type: 'milestone' as const
      }));

      // Calculate time overrun in months strictly from official PAIMANA dates if revised target exists
      const timeOverrunMonths = calcMonthDifference(
        latest.original_target_completion_mm_yyyy,
        latest.revised_target_completion_mm_yyyy
      );

      // Calculate cost overrun %: (revised - original) / original * 100
      const costOverrunPercent = latest.original_cost_cr > 0
        ? Math.max(0, parseFloat((((latest.revised_cost_cr - latest.original_cost_cr) / latest.original_cost_cr) * 100).toFixed(1)))
        : 0;

      const project: Project = {
        id: pid,
        name: latest.project_name,
        code: latest.legacy_ocms_code || (latest.pmgid ? `PMG-${latest.pmgid}` : `PAIMANA-${pid}`),
        sector: derivedSector,
        derivedSector, // Explicitly labeled as internal derived classification
        ministry: undefined,
        state: latest.state,
        implementingAgency: latest.agency,
        // Strictly null coordinates: PAIMANA dataset contains no geocoordinates; do NOT invent them
        location: {
          lat: null,
          lng: null,
          city: '',
          state: latest.state
        },
        originalCostCr: latest.original_cost_cr,
        revisedCostCr: latest.revised_cost_cr,
        cumulativeExpenditureCr: latest.cumulative_expenditure_cr,
        costOverrunPercent,
        // Actual PAIMANA field: spending as % of revised cost
        expenditurePctOfRevisedCost: latest.expenditure_pct_of_revised_cost,
        originalStartDate: latest.approval_start_mm_yyyy || '',
        originalCompletionDate: latest.original_target_completion_mm_yyyy || '',
        revisedCompletionDate: latest.revised_target_completion_mm_yyyy || latest.original_target_completion_mm_yyyy || '',
        timeOverrunMonths,
        physicalProgressPercent: latest.physical_progress_pct,
        // Keep physical progress and expenditure clearly separate; do not treat expenditure as "financial progress"
        financialProgressPercent: null,
        // Zero fabrication: unrated projects have null risk score and UNRATED tier
        riskScore: null,
        riskTier: 'UNRATED',
        predictedDelayMonths: null,
        predictedCostEscalationCr: null,
        confidenceScore: null,
        primaryDelayCause: latest.revised_target_completion_mm_yyyy
          ? `Completion target revised from ${latest.original_target_completion_mm_yyyy} to ${latest.revised_target_completion_mm_yyyy} under MoSPI PAIMANA monitoring.`
          : 'Project monitored under MoSPI PAIMANA infrastructure flash reporting.',
        lastUpdated: latest.report_month,
        topRiskDrivers: [], // Zero fabrication: will be implemented in a later phase
        mitigationRoadmap: [],
        monthlyTrend,
        auditTrail,
        dataSource: 'PAIMANA',
        rawPaimana: latest // Full raw observation accessible for source transparency
      };

      this.projectsMap.set(pid, project);
    }

    // Apply PRISM Risk Engine & Priority Engine to all projects (deterministic, evidence-based)
    let ratedCount = 0;
    this.riskAssessmentsMap.clear();
    this.priorityAssessmentsMap.clear();
    for (const [pid, obsList] of this.projectObservationsMap.entries()) {
      try {
        const assessment = PRISMRiskEngine.assess(obsList);
        this.riskAssessmentsMap.set(pid, assessment);

        const project = this.projectsMap.get(pid);

        // Phase 3A: Intervention Priority Queue Assessment
        const priorityAssessment = PRISMPriorityEngine.assess(obsList, assessment);
        if (project) {
          priorityAssessment.sector = project.sector as string;
          priorityAssessment.evidence.timeOverrunMonths = project.timeOverrunMonths;
        }
        this.priorityAssessmentsMap.set(pid, priorityAssessment);

        if (project) {
          project.riskScore = assessment.riskScore;
          project.riskTier = assessment.riskTier;
          project.priorityScore = priorityAssessment.priorityScore;
          project.priorityTier = priorityAssessment.priorityTier;
          project.primaryRiskDriver = priorityAssessment.primaryRiskDriver;
          project.recommendedAction = priorityAssessment.recommendedAction;
          project.priorityReason = priorityAssessment.priorityReason;
          project.urgency = priorityAssessment.urgency;
          project.evidenceConfidence = priorityAssessment.evidenceConfidence;

          // Populate topRiskDrivers from indicators for UI display
          project.topRiskDrivers = assessment.indicators
            .filter(ind => ind.normalisedScore >= 25)
            .sort((a, b) => b.weightedContribution - a.weightedContribution)
            .slice(0, 5)
            .map(ind => ({
              id: ind.id,
              feature: ind.id,
              label: ind.label,
              // Use weightedContribution as the evidence weight value (not a SHAP value)
              shapValue: parseFloat(ind.weightedContribution.toFixed(2)),
              description: ind.description,
              // Map category to existing RiskDriver category type
              category: (ind.category === 'Schedule' ? 'Clearances & Approvals'
                : ind.category === 'Cost' ? 'Contractor & Cashflow'
                : ind.category === 'Execution' ? 'Contractor & Cashflow'
                : ind.category === 'Trend' ? 'Scope & Design'
                : 'Coordination') as any,
              severity: ind.severity === 'none' ? 'low' : ind.severity
            }));
          // Update primaryDelayCause with top risk concern if available
          if (assessment.primaryConcerns.length > 0) {
            project.primaryDelayCause = assessment.primaryConcerns[0];
          }
          ratedCount++;
        }
      } catch (err) {
        // If engines fail for a project, leave it UNRATED (safe fallback)
        console.warn(`[PaimanaRepository] Risk/priority engine failed for project ${pid}:`, err);
      }
    }

    // Generate Early Warning Alerts (evidence-based, empirical)
    this.alertsMap.clear();
    this.alertsList = PRISMAlertEngine.generateAlerts(
      Array.from(this.projectsMap.values()),
      this.projectObservationsMap
    );
    for (const alert of this.alertsList) {
      this.alertsMap.set(alert.projectId, alert);
      const project = this.projectsMap.get(alert.projectId);
      if (project) {
        project.alert = alert;
      }
    }

    this.isLoaded = true;
    console.log(`[PaimanaRepository] Successfully initialized ${this.projectsMap.size} PAIMANA projects from ${this.observations.length} observations. Risk & Priority assessed: ${ratedCount}. Early Warning Alerts: ${this.alertsList.length}.`);
  }

  /**
   * Returns list of projects matching search, state, agency, sector, and riskTier filters.
   */
  public listProjects(options: PaimanaFilterOptions = {}): { projects: Project[]; allMatching: Project[]; totalCount: number } {
    this.ensureLoaded();

    let list = Array.from(this.projectsMap.values());

    // 1. Search Filter
    if (options.search && typeof options.search === 'string') {
      const q = options.search.toLowerCase().trim();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.implementingAgency.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
      );
    }

    // 2. State Filter
    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }

    // 3. Agency Filter
    if (options.agency && options.agency !== 'ALL') {
      const a = options.agency.trim().toLowerCase();
      list = list.filter(p => p.implementingAgency.toLowerCase() === a);
    }

    // 4. Sector Filter
    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => (p.sector as string).toLowerCase() === sec || (p.derivedSector || '').toLowerCase() === sec);
    }

    // 5. Risk Tier Filter (supports 'ALL', 'UNRATED', 'CRITICAL', 'HIGH', etc.)
    if (options.riskTier && options.riskTier !== 'ALL') {
      const rt = options.riskTier.trim().toUpperCase();
      list = list.filter(p => p.riskTier === rt);
    }

    // 5b. Priority Tier Filter (supports 'ALL', 'P1', 'P2', 'P3')
    if (options.priorityTier && options.priorityTier !== 'ALL') {
      const pt = options.priorityTier.trim().toUpperCase();
      list = list.filter(p => p.priorityTier === pt);
    }

    // 6. Sorting
    const sortBy = options.sortBy || 'id';
    const sortDir = options.sortDirection || 'asc';

    list.sort((a: any, b: any) => {
      let valA = a[sortBy];
      let valB = b[sortBy];

      // Handle nulls in sorting
      if (valA == null && valB == null) return 0;
      if (valA == null) return sortDir === 'asc' ? 1 : -1;
      if (valB == null) return sortDir === 'asc' ? -1 : 1;

      if (typeof valA === 'string') {
        return sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortDir === 'asc' ? (valA - valB) : (valB - valA);
    });

    const totalCount = list.length;
    const allMatching = list;

    // Optional slicing / pagination (sanitized against negative numbers)
    let paginatedList = list;
    if (options.offset != null || options.limit != null) {
      const offset = Math.max(0, options.offset || 0);
      const limit = Math.max(0, options.limit ?? list.length);
      paginatedList = list.slice(offset, offset + limit);
    }

    return { projects: paginatedList, allMatching, totalCount };
  }

  /**
   * Retrieves single project by project_id
   */
  public getProjectById(id: string): Project | undefined {
    this.ensureLoaded();
    return this.projectsMap.get(id);
  }

  /**
   * Retrieves all monthly snapshot observations for a project (Apr, May, Jun, Jul 2026)
   */
  public getProjectObservations(id: string): PaimanaObservation[] {
    this.ensureLoaded();
    return this.projectObservationsMap.get(id) || [];
  }

  /**
   * Retrieves the pre-computed PRISM Risk Assessment for a project.
   * Returns undefined if the project is not found or risk engine failed for it.
   */
  public getProjectRiskAssessment(id: string): RiskAssessment | undefined {
    this.ensureLoaded();
    return this.riskAssessmentsMap.get(id);
  }

  /**
   * Returns repository summary metrics
   */
  public getStats(): PaimanaRepositoryStats {
    this.ensureLoaded();

    let projectsWith4Months = 0;
    let projectsMissingCoordinates = 0;
    let projectsUnrated = 0;

    for (const [pid, obs] of this.projectObservationsMap.entries()) {
      if (obs.length === 4) {
        projectsWith4Months++;
      }
      const project = this.projectsMap.get(pid);
      if (project) {
        if (project.location.lat == null || project.location.lng == null) {
          projectsMissingCoordinates++;
        }
        if (project.riskTier === 'UNRATED' || project.riskScore === null) {
          projectsUnrated++;
        }
      }
    }

    return {
      totalObservations: this.observations.length,
      uniqueProjects: this.projectsMap.size,
      projectsWith4Months,
      projectsMissingCoordinates,
      projectsUnrated,
      reportMonths: Array.from(this.monthsSet).sort()
    };
  }

  public getStates(): string[] {
    this.ensureLoaded();
    return Array.from(this.statesSet).filter(Boolean).sort();
  }

  public getAgencies(): string[] {
    this.ensureLoaded();
    return Array.from(this.agenciesSet).filter(Boolean).sort();
  }

  public getSectors(): string[] {
    this.ensureLoaded();
    return Array.from(this.sectorsSet).filter(Boolean).sort();
  }

  /**
   * Dynamically calculates sector intelligence metrics across all loaded projects.
   * Sector classifications are derived from implementing agencies.
   */
  public getSectorStats(projects?: Project[]): SectorStat[] {
    this.ensureLoaded();
    const targetProjects = projects || Array.from(this.projectsMap.values());
    const map = new Map<string, {
      totalProjects: number;
      totalProgress: number;
      highRiskProjects: number;
      criticalProjects: number;
      totalRisk: number;
      ratedCount: number;
      totalBudgetCr: number;
    }>();

    for (const p of targetProjects) {
      const sec = (p.sector as string) || 'Other Infrastructure';
      if (!map.has(sec)) {
        map.set(sec, {
          totalProjects: 0,
          totalProgress: 0,
          highRiskProjects: 0,
          criticalProjects: 0,
          totalRisk: 0,
          ratedCount: 0,
          totalBudgetCr: 0
        });
      }
      const entry = map.get(sec)!;
      entry.totalProjects += 1;
      entry.totalProgress += (p.physicalProgressPercent || 0);
      entry.totalBudgetCr += (p.revisedCostCr || 0);
      if (p.riskTier === 'CRITICAL') entry.criticalProjects += 1;
      if (p.riskTier === 'HIGH') entry.highRiskProjects += 1;
      if (p.riskScore != null) {
        entry.totalRisk += p.riskScore;
        entry.ratedCount += 1;
      }
    }

    const result: SectorStat[] = [];
    for (const [sec, stats] of map.entries()) {
      result.push({
        sector: sec,
        totalProjects: stats.totalProjects,
        avgPhysicalProgress: stats.totalProjects > 0 ? parseFloat((stats.totalProgress / stats.totalProjects).toFixed(1)) : 0,
        criticalProjects: stats.criticalProjects,
        highRiskProjects: stats.highRiskProjects,
        avgRiskScore: stats.ratedCount > 0 ? parseFloat((stats.totalRisk / stats.ratedCount).toFixed(1)) : 0,
        totalBudgetCr: Math.round(stats.totalBudgetCr)
      });
    }

    // Sort by project count descending
    result.sort((a, b) => b.totalProjects - a.totalProjects);
    return result;
  }

  public getSectorAnalytics(projects?: Project[]): SectorStat[] {
    return this.getSectorStats(projects);
  }

  public computeKPIs(projects?: Project[]): PortfolioKPIs {
    this.ensureLoaded();
    const targetProjects = projects || Array.from(this.projectsMap.values());
    const totalProjects = targetProjects.length;

    let criticalProjects = 0;
    let highRiskProjects = 0;
    let moderateRiskProjects = 0;
    let lowRiskProjects = 0;
    let unratedProjects = 0;
    let p1Projects = 0;
    let p2Projects = 0;
    let p3Projects = 0;
    let totalBudgetCr = 0;
    let budgetAtRiskCr = 0;
    let totalDelayMonths = 0;
    let totalCostEscalationPercent = 0;
    let totalRiskScore = 0;
    let ratedRiskCount = 0;
    let totalPhysicalProgress = 0;

    for (const p of targetProjects) {
      totalBudgetCr += (p.revisedCostCr || 0);
      totalDelayMonths += (p.timeOverrunMonths || 0);
      totalCostEscalationPercent += (p.costOverrunPercent || 0);
      totalPhysicalProgress += (p.physicalProgressPercent || 0);

      if (p.riskScore != null) {
        totalRiskScore += p.riskScore;
        ratedRiskCount++;
      }

      if (p.riskTier === 'CRITICAL') {
        criticalProjects++;
        budgetAtRiskCr += p.revisedCostCr;
      } else if (p.riskTier === 'HIGH') {
        highRiskProjects++;
        budgetAtRiskCr += p.revisedCostCr * 0.65;
      } else if (p.riskTier === 'MODERATE') {
        moderateRiskProjects++;
        budgetAtRiskCr += p.revisedCostCr * 0.25;
      } else if (p.riskTier === 'LOW') {
        lowRiskProjects++;
        budgetAtRiskCr += p.revisedCostCr * 0.05;
      } else {
        unratedProjects++;
      }

      // Priority Tiers (Phase 3A)
      if (p.priorityTier === 'P1') {
        p1Projects++;
      } else if (p.priorityTier === 'P2') {
        p2Projects++;
      } else if (p.priorityTier === 'P3') {
        p3Projects++;
      }
    }

    return {
      totalProjects,
      criticalProjects,
      highRiskProjects,
      moderateRiskProjects,
      lowRiskProjects,
      unratedProjects,
      p1Projects,
      p2Projects,
      p3Projects,
      totalBudgetCr: Math.round(totalBudgetCr),
      budgetAtRiskCr: Math.round(budgetAtRiskCr),
      averageDelayMonths: totalProjects > 0 ? Math.round((totalDelayMonths / totalProjects) * 10) / 10 : 0,
      averageCostEscalationPercent: totalProjects > 0 ? Math.round((totalCostEscalationPercent / totalProjects) * 10) / 10 : 0,
      activeEscalationsCount: criticalProjects + highRiskProjects,
      averageRiskScore: ratedRiskCount > 0 ? Math.round((totalRiskScore / ratedRiskCount) * 10) / 10 : 0,
      averagePhysicalProgress: totalProjects > 0 ? Math.round((totalPhysicalProgress / totalProjects) * 10) / 10 : 0
    };
  }

  /**
   * Computes complete multi-dimensional analytics across all PAIMANA projects & observations.
   * Zero hardcoded values.
   */
  public getFullAnalytics(targetProjects?: Project[]) {
    this.ensureLoaded();
    const projects = targetProjects || Array.from(this.projectsMap.values());
    const totalProjects = projects.length;
    const kpis = this.computeKPIs(projects);

    // 1. Observations by Month & Longitudinal Coverage
    const observationsByMonth: Record<string, number> = {};
    for (const obs of this.observations) {
      if (obs.report_month) {
        observationsByMonth[obs.report_month] = (observationsByMonth[obs.report_month] || 0) + 1;
      }
    }

    const coverageCounts = { '4 Observations': 0, '3 Observations': 0, '2 Observations': 0, '1 Observation': 0 };
    for (const p of projects) {
      const len = p.monthlyTrend?.length || 0;
      if (len >= 4) coverageCounts['4 Observations']++;
      else if (len === 3) coverageCounts['3 Observations']++;
      else if (len === 2) coverageCounts['2 Observations']++;
      else coverageCounts['1 Observation']++;
    }

    // 2. Risk Tier Distribution (CRITICAL: 80-100, HIGH: 60-79, MODERATE: 40-59, LOW: 0-39)
    const riskDistribution = [
      { name: 'Critical (80–100)', tier: 'CRITICAL', count: kpis.criticalProjects, percent: totalProjects > 0 ? parseFloat(((kpis.criticalProjects / totalProjects) * 100).toFixed(1)) : 0, color: '#ef4444' },
      { name: 'High (60–79)', tier: 'HIGH', count: kpis.highRiskProjects, percent: totalProjects > 0 ? parseFloat(((kpis.highRiskProjects / totalProjects) * 100).toFixed(1)) : 0, color: '#f97316' },
      { name: 'Moderate (40–59)', tier: 'MODERATE', count: kpis.moderateRiskProjects, percent: totalProjects > 0 ? parseFloat(((kpis.moderateRiskProjects / totalProjects) * 100).toFixed(1)) : 0, color: '#eab308' },
      { name: 'Low (0–39)', tier: 'LOW', count: kpis.lowRiskProjects, percent: totalProjects > 0 ? parseFloat(((kpis.lowRiskProjects / totalProjects) * 100).toFixed(1)) : 0, color: '#10b981' }
    ];

    // 3. Priority Tier Distribution (P1 >= 70, P2: 50-69, P3 < 50)
    const priorityDistribution = [
      { name: 'P1 Immediate Urgency (≥70)', tier: 'P1', count: kpis.p1Projects || 0, percent: totalProjects > 0 ? parseFloat((((kpis.p1Projects || 0) / totalProjects) * 100).toFixed(1)) : 0, color: '#ef4444' },
      { name: 'P2 Significant Oversight (50–69)', tier: 'P2', count: kpis.p2Projects || 0, percent: totalProjects > 0 ? parseFloat((((kpis.p2Projects || 0) / totalProjects) * 100).toFixed(1)) : 0, color: '#f97316' },
      { name: 'P3 Routine Monitoring (<50)', tier: 'P3', count: kpis.p3Projects || 0, percent: totalProjects > 0 ? parseFloat((((kpis.p3Projects || 0) / totalProjects) * 100).toFixed(1)) : 0, color: '#10b981' }
    ];

    // 4. Sector-Wise Detailed Analytics
    const sectorStats = this.getSectorStats(projects);
    const sectorAnalytics = sectorStats.map(s => {
      const sectorProjs = projects.filter(p => (p.sector as string) === s.sector);
      const origCost = sectorProjs.reduce((sum, p) => sum + (p.originalCostCr || 0), 0);
      const revCost = s.totalBudgetCr;
      const overrunPct = origCost > 0 ? parseFloat((((revCost - origCost) / origCost) * 100).toFixed(1)) : 0;
      const avgDelay = Math.round(sectorProjs.reduce((sum, p) => sum + (p.timeOverrunMonths || 0), 0) / (sectorProjs.length || 1));

      return {
        sector: s.sector,
        projectCount: s.totalProjects,
        portfolioPercent: totalProjects > 0 ? parseFloat(((s.totalProjects / totalProjects) * 100).toFixed(1)) : 0,
        originalCostCr: Math.round(origCost),
        revisedCostCr: revCost,
        costOverrunPercent: overrunPct,
        avgPhysicalProgress: s.avgPhysicalProgress,
        avgRiskScore: s.avgRiskScore,
        criticalProjects: s.criticalProjects,
        highRiskProjects: s.highRiskProjects,
        avgDelayMonths: avgDelay
      };
    });

    // 5. State-Wise Detailed Analytics
    const stateMap = new Map<string, {
      count: number;
      totalBudget: number;
      totalRisk: number;
      ratedCount: number;
      criticalCount: number;
      highCount: number;
      totalProgress: number;
    }>();

    for (const p of projects) {
      const state = p.state || 'Unspecified';
      if (!stateMap.has(state)) {
        stateMap.set(state, { count: 0, totalBudget: 0, totalRisk: 0, ratedCount: 0, criticalCount: 0, highCount: 0, totalProgress: 0 });
      }
      const item = stateMap.get(state)!;
      item.count++;
      item.totalBudget += (p.revisedCostCr || 0);
      item.totalProgress += (p.physicalProgressPercent || 0);
      if (p.riskTier === 'CRITICAL') item.criticalCount++;
      if (p.riskTier === 'HIGH') item.highCount++;
      if (p.riskScore != null) {
        item.totalRisk += p.riskScore;
        item.ratedCount++;
      }
    }

    const stateAnalytics = Array.from(stateMap.entries())
      .map(([state, data]) => ({
        state,
        projectCount: data.count,
        totalBudgetCr: Math.round(data.totalBudget),
        avgRiskScore: data.ratedCount > 0 ? parseFloat((data.totalRisk / data.ratedCount).toFixed(1)) : 0,
        criticalCount: data.criticalCount,
        highCount: data.highCount,
        avgPhysicalProgress: data.count > 0 ? parseFloat((data.totalProgress / data.count).toFixed(1)) : 0
      }))
      .sort((a, b) => b.projectCount - a.projectCount);

    // 6. Cost Escalation Brackets
    let totalOriginalCostCr = 0;
    let totalRevisedCostCr = 0;
    let overrunSevere = 0; // > 50%
    let overrunModerate = 0; // 20 - 50%
    let overrunMinor = 0; // 1 - 20%
    let overrunNone = 0; // 0%

    for (const p of projects) {
      totalOriginalCostCr += (p.originalCostCr || 0);
      totalRevisedCostCr += (p.revisedCostCr || 0);
      const over = p.costOverrunPercent || 0;
      if (over >= 50) overrunSevere++;
      else if (over >= 20) overrunModerate++;
      else if (over > 0) overrunMinor++;
      else overrunNone++;
    }

    const costEscalation = {
      totalOriginalCostCr: Math.round(totalOriginalCostCr),
      totalRevisedCostCr: Math.round(totalRevisedCostCr),
      totalEscalationCr: Math.round(totalRevisedCostCr - totalOriginalCostCr),
      overallOverrunPercent: totalOriginalCostCr > 0 ? parseFloat((((totalRevisedCostCr - totalOriginalCostCr) / totalOriginalCostCr) * 100).toFixed(1)) : 0,
      brackets: [
        { name: 'Severe (>50%)', count: overrunSevere, percent: totalProjects > 0 ? parseFloat(((overrunSevere / totalProjects) * 100).toFixed(1)) : 0, color: '#ef4444' },
        { name: 'Moderate (20–50%)', count: overrunModerate, percent: totalProjects > 0 ? parseFloat(((overrunModerate / totalProjects) * 100).toFixed(1)) : 0, color: '#f97316' },
        { name: 'Minor (1–20%)', count: overrunMinor, percent: totalProjects > 0 ? parseFloat(((overrunMinor / totalProjects) * 100).toFixed(1)) : 0, color: '#eab308' },
        { name: 'On Budget (0%)', count: overrunNone, percent: totalProjects > 0 ? parseFloat(((overrunNone / totalProjects) * 100).toFixed(1)) : 0, color: '#10b981' }
      ]
    };

    // 7. Execution Indicators & Stagnation Metrics
    let stagnantCount = 0;
    let deceleratingCount = 0;
    let divergenceCount = 0;

    for (const p of projects) {
      const trend = p.monthlyTrend || [];
      if (trend.length >= 2) {
        let stag = 0;
        for (let i = trend.length - 1; i >= 1; i--) {
          if (Math.abs((trend[i].actualPercent ?? 0) - (trend[i - 1].actualPercent ?? 0)) <= 0.2) stag++;
          else break;
        }
        if (stag >= 2) stagnantCount++;
      }
      if (p.urgency && p.urgency >= 80) deceleratingCount++;
      const expPct = p.expenditurePctOfRevisedCost ?? (p.revisedCostCr > 0 ? (p.cumulativeExpenditureCr / p.revisedCostCr) * 100 : 0);
      if (expPct - (p.physicalProgressPercent || 0) >= 15) divergenceCount++;
    }

    const executionIndicators = {
      prolongedStagnationCount: stagnantCount,
      stagnationRate: totalProjects > 0 ? parseFloat(((stagnantCount / totalProjects) * 100).toFixed(1)) : 0,
      divergenceCount,
      divergenceRate: totalProjects > 0 ? parseFloat(((divergenceCount / totalProjects) * 100).toFixed(1)) : 0,
      criticalUrgencyCount: deceleratingCount
    };

    return {
      kpis,
      observationsCoverage: {
        totalObservations: this.observations.length,
        observationsByMonth,
        coverageCounts
      },
      riskDistribution,
      priorityDistribution,
      sectorAnalytics,
      stateAnalytics,
      costEscalation,
      executionIndicators
    };
  }

  /**
   * Retrieves priority assessment for a single project (Phase 3A)
   */
  public getProjectPriorityAssessment(id: string): PriorityAssessment | undefined {
    this.ensureLoaded();
    return this.priorityAssessmentsMap.get(id);
  }

  /**
   * Returns prioritized intervention queue with filtering support (Phase 3A).
   * Sorted by priorityScore descending.
   */
  public listPriorities(options: {
    limit?: number;
    state?: string;
    agency?: string;
    sector?: string;
    priorityTier?: string;
  } = {}): {
    priorities: PriorityAssessment[];
    totalCount: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
  } {
    this.ensureLoaded();
    let list = Array.from(this.priorityAssessmentsMap.values());

    // Pre-tier filters: state, agency, sector
    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }
    if (options.agency && options.agency !== 'ALL') {
      const a = options.agency.trim().toLowerCase();
      list = list.filter(p => p.implementingAgency.toLowerCase() === a);
    }
    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => p.sector.toLowerCase() === sec);
    }

    const p1Count = list.filter(p => p.priorityTier === 'P1').length;
    const p2Count = list.filter(p => p.priorityTier === 'P2').length;
    const p3Count = list.filter(p => p.priorityTier === 'P3').length;

    // Filter by priority tier if requested
    let filtered = list;
    if (options.priorityTier && options.priorityTier !== 'ALL') {
      const pt = options.priorityTier.trim().toUpperCase();
      filtered = filtered.filter(p => p.priorityTier === pt);
    }

    // Sort by priorityScore DESCENDING (Intervention Priority Queue)
    filtered.sort((a, b) => b.priorityScore - a.priorityScore);

    const limit = options.limit != null ? Math.max(1, options.limit) : 50;
    const sliced = filtered.slice(0, limit);

    return {
      priorities: sliced,
      totalCount: filtered.length,
      p1Count,
      p2Count,
      p3Count
    };
  }

  /**
   * Retrieves Early Warning Alerts matching filter options.
   * Evidence-based, empirical signals derived from observed PAIMANA data.
   */
  public getEarlyWarningAlerts(options: {
    severity?: string;
    alertType?: string;
    sector?: string;
    state?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): {
    alerts: EarlyWarningAlert[];
    totalCount: number;
    countsBySeverity: { critical: number; high: number; medium: number; total: number };
    countsByType: Record<string, number>;
  } {
    this.ensureLoaded();

    let filtered = [...this.alertsList];

    if (options.severity && options.severity !== 'ALL') {
      filtered = filtered.filter(a => a.severity === options.severity);
    }

    if (options.alertType && options.alertType !== 'ALL') {
      filtered = filtered.filter(a => a.alertType === options.alertType);
    }

    if (options.sector && options.sector !== 'ALL') {
      filtered = filtered.filter(a => a.sector === options.sector);
    }

    if (options.state && options.state !== 'ALL') {
      filtered = filtered.filter(a => a.state === options.state);
    }

    if (options.search && typeof options.search === 'string') {
      const q = options.search.toLowerCase().trim();
      filtered = filtered.filter(a =>
        a.projectName.toLowerCase().includes(q) ||
        a.projectCode.toLowerCase().includes(q) ||
        a.evidence.toLowerCase().includes(q) ||
        a.state.toLowerCase().includes(q)
      );
    }

    const countsBySeverity = {
      critical: this.alertsList.filter(a => a.severity === 'CRITICAL').length,
      high: this.alertsList.filter(a => a.severity === 'HIGH').length,
      medium: this.alertsList.filter(a => a.severity === 'MEDIUM').length,
      total: this.alertsList.length
    };

    const countsByType: Record<string, number> = {};
    for (const a of this.alertsList) {
      countsByType[a.alertType] = (countsByType[a.alertType] || 0) + 1;
    }

    const totalCount = filtered.length;
    const offset = options.offset || 0;
    const limit = options.limit || totalCount;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      alerts: paginated,
      totalCount,
      countsBySeverity,
      countsByType
    };
  }

  /**
   * Retrieves Early Warning Alert for a single project (if active).
   */
  public getProjectAlert(projectId: string): EarlyWarningAlert | null {
    this.ensureLoaded();
    return this.alertsMap.get(projectId) || null;
  }

  private ensureLoaded(): void {
    if (!this.isLoaded) {
      this.load();
    }
  }
}

// Export singleton instance
export const paimanaRepository = new PaimanaRepository();
