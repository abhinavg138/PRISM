/**
 * PRISM Canonical Project Query Service
 *
 * Single Source of Truth for querying, filtering, ranking, and aggregating
 * projects across Dashboard, Project Table, Analytics, and AI Copilot.
 *
 * Enforces:
 *  - Deterministic risk bands (CRITICAL: 80-100, HIGH: 60-79, MODERATE: 40-59, LOW: 0-39)
 *  - Canonical state classification (Dedicated in-state vs Multi-state corridors)
 *  - Consistent priority ranking from PRISMPriorityEngine
 *  - Full-dataset KPI calculations (never on paginated slices)
 *  - Zero hallucination / zero frontend risk recalculation
 */

import { Project, RiskTier, PriorityTier, PortfolioKPIs } from '../src/types/index';
import { paimanaRepository } from './paimanaRepository';

export interface CanonicalFilterOptions {
  search?: string;
  state?: string;
  includeMultiState?: boolean;
  sector?: string;
  agency?: string;
  riskTier?: RiskTier | 'ALL';
  priorityTier?: PriorityTier | 'ALL';
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface StatePartition {
  canonicalState: string;
  dedicatedProjects: Project[];
  multiStateProjects: Project[];
  allAssociatedProjects: Project[];
  dedicatedCount: number;
  multiStateCount: number;
  totalAssociatedCount: number;
  dedicatedKPIs: PortfolioKPIs;
  allAssociatedKPIs: PortfolioKPIs;
  dedicatedByRisk: Record<RiskTier | 'UNRATED', number>;
  multiStateByRisk: Record<RiskTier | 'UNRATED', number>;
  totalByRisk: Record<RiskTier | 'UNRATED', number>;
}

export interface CanonicalQueryResult {
  projects: Project[];
  allMatching: Project[];
  totalCount: number;
  kpis: PortfolioKPIs;
}

export class ProjectQueryService {
  /**
   * Universal project filter and query executor.
   * Shared by /api/projects, Dashboard, and Copilot Intent Gate.
   */
  static query(options: CanonicalFilterOptions = {}): CanonicalQueryResult {
    const defaultSortBy = options.sortBy || (options.riskTier && options.riskTier !== 'ALL' ? 'riskScore' : options.priorityTier && options.priorityTier !== 'ALL' ? 'priorityScore' : 'id');
    const defaultSortDir = options.sortDirection || ((defaultSortBy === 'riskScore' || defaultSortBy === 'priorityScore') ? 'desc' : 'asc');

    const { projects: paginated, allMatching, totalCount } = paimanaRepository.listProjects({
      search: options.search,
      state: options.state,
      agency: options.agency,
      sector: options.sector,
      riskTier: options.riskTier,
      priorityTier: options.priorityTier,
      sortBy: defaultSortBy,
      sortDirection: defaultSortDir,
      limit: options.limit,
      offset: options.offset
    });

    // Compute KPIs on the complete matching dataset, NEVER on paginated slice
    const kpis = paimanaRepository.computeKPIs(allMatching);

    return {
      projects: paginated,
      allMatching,
      totalCount,
      kpis
    };
  }

  /**
   * Canonical State Partition & Breakdown.
   * Distinguishes Dedicated in-state projects from Multi-state corridors involving the state.
   */
  static getStatePartition(stateName: string): StatePartition | null {
    const s = stateName.trim().toLowerCase();
    const all = paimanaRepository.listProjects().allMatching;

    // Find canonical name if available
    const exactMatch = all.find(p => p.state.trim().toLowerCase() === s);
    const canonicalState = exactMatch ? exactMatch.state.trim() : stateName.trim();

    const dedicatedProjects = all.filter(p => p.state.trim().toLowerCase() === s);
    const multiStateProjects = all.filter(p =>
      p.state.trim().toLowerCase() !== s &&
      p.state.toLowerCase().includes(s)
    );

    if (dedicatedProjects.length === 0 && multiStateProjects.length === 0) {
      return null;
    }

    const allAssociatedProjects = [...dedicatedProjects, ...multiStateProjects];

    const initRiskCounts = (): Record<RiskTier | 'UNRATED', number> => ({
      CRITICAL: 0,
      HIGH: 0,
      MODERATE: 0,
      LOW: 0,
      UNRATED: 0
    });

    const dedicatedByRisk = initRiskCounts();
    for (const p of dedicatedProjects) {
      const t = (p.riskTier as RiskTier) || 'UNRATED';
      dedicatedByRisk[t] = (dedicatedByRisk[t] || 0) + 1;
    }

    const multiStateByRisk = initRiskCounts();
    for (const p of multiStateProjects) {
      const t = (p.riskTier as RiskTier) || 'UNRATED';
      multiStateByRisk[t] = (multiStateByRisk[t] || 0) + 1;
    }

    const totalByRisk = initRiskCounts();
    for (const p of allAssociatedProjects) {
      const t = (p.riskTier as RiskTier) || 'UNRATED';
      totalByRisk[t] = (totalByRisk[t] || 0) + 1;
    }

    return {
      canonicalState,
      dedicatedProjects,
      multiStateProjects,
      allAssociatedProjects,
      dedicatedCount: dedicatedProjects.length,
      multiStateCount: multiStateProjects.length,
      totalAssociatedCount: allAssociatedProjects.length,
      dedicatedKPIs: paimanaRepository.computeKPIs(dedicatedProjects),
      allAssociatedKPIs: paimanaRepository.computeKPIs(allAssociatedProjects),
      dedicatedByRisk,
      multiStateByRisk,
      totalByRisk
    };
  }

  /**
   * Canonical State + Risk Tier Query.
   * Returns exact matching projects, guaranteed identical to Dashboard filter.
   */
  static getProjectsByStateAndRisk(
    stateName: string,
    riskTier: RiskTier,
    options: { limit?: number; includeMultiState?: boolean } = {}
  ): {
    canonicalState: string;
    riskTier: RiskTier;
    dedicatedProjects: Project[];
    multiStateProjects: Project[];
    totalCount: number;
    matchingProjects: Project[];
    displayProjects: Project[];
    multiStateNotice?: string;
  } {
    const partition = this.getStatePartition(stateName);
    const targetTier = riskTier.toUpperCase() as RiskTier;

    if (!partition) {
      return {
        canonicalState: stateName,
        riskTier: targetTier,
        dedicatedProjects: [],
        multiStateProjects: [],
        totalCount: 0,
        matchingProjects: [],
        displayProjects: []
      };
    }

    // Sort deterministically: riskScore DESC, id ASC
    const sortFn = (a: Project, b: Project) => {
      const sDiff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
      if (sDiff !== 0) return sDiff;
      return a.id.localeCompare(b.id);
    };

    const dedicatedMatching = partition.dedicatedProjects
      .filter(p => p.riskTier === targetTier)
      .sort(sortFn);

    const multiStateMatching = partition.multiStateProjects
      .filter(p => p.riskTier === targetTier)
      .sort(sortFn);

    // Canonical matching matches the Dashboard: dedicated projects in that state
    const canonicalMatching = options.includeMultiState
      ? [...dedicatedMatching, ...multiStateMatching].sort(sortFn)
      : dedicatedMatching;

    const limit = options.limit || 5;
    const displayProjects = canonicalMatching.slice(0, limit);

    let multiStateNotice: string | undefined;
    if (!options.includeMultiState && multiStateMatching.length > 0) {
      multiStateNotice = `There are also ${multiStateMatching.length} multi-state project(s) involving ${partition.canonicalState} with ${targetTier} risk (${multiStateMatching.map(p => `${p.name.split('(')[0].trim()} [${p.id}]`).join(', ')}).`;
    }

    return {
      canonicalState: partition.canonicalState,
      riskTier: targetTier,
      dedicatedProjects: dedicatedMatching,
      multiStateProjects: multiStateMatching,
      totalCount: dedicatedMatching.length,
      matchingProjects: canonicalMatching,
      displayProjects,
      multiStateNotice
    };
  }

  /**
   * Canonical Priority Queue Query.
   * Rank-ordered strictly by priorityScore DESC, id ASC.
   */
  static getPriorityProjects(options: {
    state?: string;
    sector?: string;
    priorityTier?: PriorityTier;
    limit?: number;
  } = {}): {
    projects: Project[];
    totalMatching: number;
    p1Count: number;
    p2Count: number;
    p3Count: number;
  } {
    let list = paimanaRepository.listProjects().allMatching;

    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }

    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => (p.sector as string).toLowerCase() === sec || (p.derivedSector || '').toLowerCase() === sec);
    }

    if (options.priorityTier && (options.priorityTier as string) !== 'ALL') {
      const pt = (options.priorityTier as string).trim().toUpperCase() as PriorityTier;
      list = list.filter(p => p.priorityTier === pt);
    }

    // Deterministic sort: priorityScore DESC, riskScore DESC, id ASC
    list.sort((a, b) => {
      const pDiff = (b.priorityScore ?? 0) - (a.priorityScore ?? 0);
      if (pDiff !== 0) return pDiff;
      const rDiff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
      if (rDiff !== 0) return rDiff;
      return a.id.localeCompare(b.id);
    });

    const p1Count = list.filter(p => p.priorityTier === 'P1').length;
    const p2Count = list.filter(p => p.priorityTier === 'P2').length;
    const p3Count = list.filter(p => p.priorityTier === 'P3').length;

    const limit = options.limit || 5;
    return {
      projects: list.slice(0, limit),
      totalMatching: list.length,
      p1Count,
      p2Count,
      p3Count
    };
  }

  /**
   * Canonical Highest Risk Projects.
   * Rank-ordered strictly by riskScore DESC, id ASC.
   */
  static getTopRiskProjects(options: {
    state?: string;
    sector?: string;
    limit?: number;
  } = {}): {
    projects: Project[];
    totalCritical: number;
    totalHigh: number;
  } {
    let list = paimanaRepository.listProjects().allMatching.filter(p => p.riskScore != null);

    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }

    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => (p.sector as string).toLowerCase() === sec || (p.derivedSector || '').toLowerCase() === sec);
    }

    const totalCritical = list.filter(p => p.riskTier === 'CRITICAL').length;
    const totalHigh = list.filter(p => p.riskTier === 'HIGH').length;

    // Deterministic sort: riskScore DESC, id ASC
    list.sort((a, b) => {
      const diff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    const limit = options.limit || 5;
    return {
      projects: list.slice(0, limit),
      totalCritical,
      totalHigh
    };
  }

  /**
   * Canonical Stagnant Projects.
   * Derived strictly from PRISM Progress Stagnation indicators (delta <= 0.5 pp).
   */
  static getStagnantProjects(options: {
    state?: string;
    sector?: string;
    limit?: number;
  } = {}): {
    projects: Project[];
    totalStagnant: number;
  } {
    let list = paimanaRepository.listProjects().allMatching;

    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }

    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => (p.sector as string).toLowerCase() === sec || (p.derivedSector || '').toLowerCase() === sec);
    }

    // Filter projects where stagnation is detected
    const stagnant = list.filter(p => {
      const hasStagnantDriver = (p.primaryRiskDriver && p.primaryRiskDriver.toLowerCase().includes('stagnat')) ||
        (p.topRiskDrivers && p.topRiskDrivers.some(d => d.label.toLowerCase().includes('stagnat')));
      const hasStagnantAlert = p.alert && p.alert.alertType === 'Progress Stagnation';
      return Boolean(hasStagnantDriver || hasStagnantAlert);
    });

    // Deterministic sort: riskScore DESC, id ASC
    stagnant.sort((a, b) => {
      const diff = (b.riskScore ?? 0) - (a.riskScore ?? 0);
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });

    const limit = options.limit || 5;
    return {
      projects: stagnant.slice(0, limit),
      totalStagnant: stagnant.length
    };
  }

  /**
   * Canonical Healthy / Good Pace Projects (Phase 11).
   * Strictly verifies LOW risk tier (0-39), zero schedule slippage, zero cost overrun,
   * and positive progress velocity. Does NOT equate high progress with good pace.
   */
  static getHealthyPaceProjects(options: {
    state?: string;
    sector?: string;
    limit?: number;
  } = {}): {
    projects: Project[];
    totalHealthy: number;
    qualificationNote: string;
  } {
    let list = paimanaRepository.listProjects().allMatching;

    if (options.state && options.state !== 'ALL') {
      const s = options.state.trim().toLowerCase();
      list = list.filter(p => p.state.toLowerCase() === s);
    }

    if (options.sector && options.sector !== 'ALL') {
      const sec = options.sector.trim().toLowerCase();
      list = list.filter(p => (p.sector as string).toLowerCase() === sec || (p.derivedSector || '').toLowerCase() === sec);
    }

    // Verified healthy progression criteria:
    // 1. LOW risk tier (0-39)
    // 2. Zero schedule slippage (timeOverrunMonths <= 0)
    // 3. Zero cost overrun (costOverrunPercent <= 0)
    // 4. Physical progress > 0
    const pristine = list.filter(p =>
      p.riskTier === 'LOW' &&
      (p.timeOverrunMonths || 0) <= 0 &&
      (p.costOverrunPercent || 0) <= 0 &&
      (p.physicalProgressPercent || 0) > 0
    );

    pristine.sort((a, b) => {
      // Sort by physical progress DESC, then lowest riskScore ASC, then id ASC
      const progDiff = (b.physicalProgressPercent || 0) - (a.physicalProgressPercent || 0);
      if (progDiff !== 0) return progDiff;
      const rDiff = (a.riskScore ?? 0) - (b.riskScore ?? 0);
      if (rDiff !== 0) return rDiff;
      return a.id.localeCompare(b.id);
    });

    const limit = options.limit || 5;

    return {
      projects: pristine.slice(0, limit),
      totalHealthy: pristine.length,
      qualificationNote: 'Healthy pace qualification requires: PRISM Risk Tier LOW (0–39), 0 months schedule slippage, 0% cost overrun, and positive verified physical progress.'
    };
  }
}
