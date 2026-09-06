import { Project, PortfolioKPIs } from '../src/types/index';

export const SEEDED_PROJECTS: Project[] = [
  {
    id: 'PRJ-IN-001',
    name: 'Udhampur-Srinagar-Baramulla Rail Link (USBRL)',
    code: 'RLY-NR-USBRL-272',
    sector: 'Railways',
    ministry: 'Ministry of Railways',
    state: 'Jammu & Kashmir',
    implementingAgency: 'Northern Railway & KRCL',
    location: {
      lat: 33.2778,
      lng: 75.3412,
      city: 'Reasi / Banihal',
      state: 'Jammu & Kashmir'
    },
    originalCostCr: 4200,
    revisedCostCr: 37012,
    cumulativeExpenditureCr: 34180,
    costOverrunPercent: 781.2,
    originalStartDate: '2002-03-15',
    originalCompletionDate: '2007-12-31',
    revisedCompletionDate: '2026-10-31',
    timeOverrunMonths: 226,
    physicalProgressPercent: 94.2,
    financialProgressPercent: 92.3,
    riskScore: 88,
    riskTier: 'CRITICAL',
    predictedDelayMonths: 8.4,
    predictedCostEscalationCr: 2150,
    confidenceScore: 0.94,
    primaryDelayCause: 'Complex Himalayan fault geology, deep gorge bridge wind dynamics, and specialized tunnel water ingress.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-1',
        feature: 'geological_complexity_index',
        label: 'Himalayan Thrust Faults & Rock Bursting',
        shapValue: 24.8,
        description: 'Encounter of shearing thrust zones in Tunnel T-1 requires slow-advance forepoling and chemical grouting.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-2',
        feature: 'land_acquisition_pending_ratio',
        label: 'Residual Station Approach Land Disputes',
        shapValue: 14.5,
        description: 'Pending compensation settlement for 18.4 hectares along Katra yard expansion.',
        category: 'Land Acquisition',
        severity: 'high'
      },
      {
        id: 'rd-3',
        feature: 'specialized_engineering_hazard',
        label: 'Wind Sensor Dynamic Dampers on Chenab Bridge',
        shapValue: 12.2,
        description: 'High-altitude crosswind buffering requires continuous calibration before high-speed rake clearance.',
        category: 'Scope & Design',
        severity: 'medium'
      },
      {
        id: 'rd-4',
        feature: 'contractor_cashflow_health',
        label: 'Joint-Venture Sub-contractor Liquidity',
        shapValue: 9.3,
        description: 'Vendor payment backlog of ₹85 Cr causing machinery maintenance slowdown in Pir Panjal sector.',
        category: 'Contractor & Cashflow',
        severity: 'medium'
      },
      {
        id: 'rd-5',
        feature: 'statutory_clearances_cleared',
        label: 'CRS Final Safety Statutory Authorization',
        shapValue: -5.1,
        description: 'Speed trials completed on 209 km already; Commissioner of Railway Safety interim nod secured.',
        category: 'Clearances & Approvals',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1',
        action: 'Deploy specialized Norwegian Tunneling Method (NATM) heavy grouting crew to Tunnel T-1 bypass',
        timeframe: 'Next 30 Days',
        impact: 'Reduces projected delay by 3.5 months',
        responsibleParty: 'KRCL Chief Engineer (Tunnels)',
        status: 'In Progress',
        riskReductionPoints: 12
      },
      {
        id: 'mit-2',
        action: 'Release ₹95 Cr targeted working capital advance against verified sub-grade work',
        timeframe: 'Immediate (14 Days)',
        impact: 'Prevents contractor demobilization',
        responsibleParty: 'Financial Advisor & CAO (Northern Railway)',
        status: 'Pending',
        riskReductionPoints: 7
      },
      {
        id: 'mit-3',
        action: 'Convene tri-party joint coordination meeting with J&K Revenue Dept for Katra land parcel possession',
        timeframe: 'Next 21 Days',
        impact: 'Removes final access block for yard electrification',
        responsibleParty: 'District Collector Reasi & NR Land Directorate',
        status: 'In Progress',
        riskReductionPoints: 9
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 91.0, actualPercent: 89.8, financialExpenditureCr: 32800 },
      { month: 'Nov 2025', plannedPercent: 92.5, actualPercent: 91.1, financialExpenditureCr: 33150 },
      { month: 'Dec 2025', plannedPercent: 93.8, actualPercent: 92.2, financialExpenditureCr: 33500 },
      { month: 'Jan 2026', plannedPercent: 95.0, actualPercent: 93.0, financialExpenditureCr: 33850 },
      { month: 'Feb 2026', plannedPercent: 96.2, actualPercent: 93.8, financialExpenditureCr: 34020 },
      { month: 'Mar 2026', plannedPercent: 97.5, actualPercent: 94.2, financialExpenditureCr: 34180 }
    ],
    auditTrail: [
      { id: 'aud-1', date: '2026-02-28', event: 'Flash Report: Tunnel T-1 seepages exceeded safety threshold; advance halted.', reportedBy: 'PMG Field Inspector', type: 'warning' },
      { id: 'aud-2', date: '2026-01-15', event: 'Milestone: Successful electrical test train run over Chenab Arch bridge.', reportedBy: 'Chief Administrative Officer', type: 'milestone' },
      { id: 'aud-3', date: '2025-11-10', event: 'Cost escalation revision approved by Cabinet Committee on Economic Affairs (CCEA).', reportedBy: 'Railway Board', type: 'audit' }
    ]
  },
  {
    id: 'PRJ-IN-002',
    name: 'Delhi-Mumbai Expressway (Phase 2 & JNPT Spur)',
    code: 'RTH-NHAI-DME-PKG',
    sector: 'Road Transport & Highways',
    ministry: 'MoRTH',
    state: 'Maharashtra',
    implementingAgency: 'National Highways Authority of India (NHAI)',
    location: {
      lat: 19.1176,
      lng: 73.0112,
      city: 'Navi Mumbai / Palghar',
      state: 'Maharashtra'
    },
    originalCostCr: 87450,
    revisedCostCr: 104500,
    cumulativeExpenditureCr: 79200,
    costOverrunPercent: 19.5,
    originalStartDate: '2019-01-10',
    originalCompletionDate: '2023-03-31',
    revisedCompletionDate: '2026-09-30',
    timeOverrunMonths: 42,
    physicalProgressPercent: 81.4,
    financialProgressPercent: 75.8,
    riskScore: 79,
    riskTier: 'HIGH',
    predictedDelayMonths: 6.2,
    predictedCostEscalationCr: 3400,
    confidenceScore: 0.91,
    primaryDelayCause: 'Palghar tribal land acquisition litigation, Dahanu eco-sensitive zone clearances, and EPC contractor credit constraints.',
    lastUpdated: '2026-03-02',
    topRiskDrivers: [
      {
        id: 'rd-201',
        feature: 'land_acquisition_litigation_density',
        label: 'Palghar-Virar Corridor Land Title Litigation',
        shapValue: 21.4,
        description: '24 writ petitions pending in Bombay High Court regarding compensation multiplier under RFCTLARR Act.',
        category: 'Land Acquisition',
        severity: 'critical'
      },
      {
        id: 'rd-202',
        feature: 'forest_wildlife_clearance_days',
        label: 'Tungareshwar Sanctuary Wildlife Eco-Corridor Permits',
        shapValue: 15.6,
        description: 'Mandated underpass redesign for leopard corridor delayed package 14 by 8 months.',
        category: 'Clearances & Approvals',
        severity: 'high'
      },
      {
        id: 'rd-203',
        feature: 'utility_shifting_pending',
        label: 'MSETCL 400kV High-Tension Transmission Towers',
        shapValue: 11.2,
        description: 'Shifting of 34 extra-high-voltage power lines awaiting shutdown approvals from Maharashtra SLDC.',
        category: 'Coordination',
        severity: 'high'
      },
      {
        id: 'rd-204',
        feature: 'contractor_debt_equity_ratio',
        label: 'Package 16 Concessionaire Credit Freeze',
        shapValue: 8.9,
        description: 'EPC lead contractor downgraded to BBB-, leading to equipment mobilization deficit.',
        category: 'Contractor & Cashflow',
        severity: 'medium'
      },
      {
        id: 'rd-205',
        feature: 'raw_material_supply_distance',
        label: 'Quarrying Royalties & Aggregate Transport',
        shapValue: 5.1,
        description: 'Inter-district crushed stone transit permits delayed by Thane district administration.',
        category: 'Coordination',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-201',
        action: 'Direct High-Level Inter-Ministerial Settlement with State Government for fast-track deposit in escrow',
        timeframe: 'Next 20 Days',
        impact: 'Clears 42 km of right-of-way in Palghar belt',
        responsibleParty: 'NHAI Member (Projects) & Maharashtra Chief Secretary',
        status: 'In Progress',
        riskReductionPoints: 11
      },
      {
        id: 'mit-202',
        action: 'Invoke NHAI Conciliation Committee of Independent Experts (CCIE) for contractor milestone release',
        timeframe: 'Next 15 Days',
        impact: 'Injects ₹180 Cr direct subcontractor liquidity',
        responsibleParty: 'CCIE Panel & Regional Officer Mumbai',
        status: 'Pending',
        riskReductionPoints: 8
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 82.0, actualPercent: 77.5, financialExpenditureCr: 75000 },
      { month: 'Nov 2025', plannedPercent: 84.0, actualPercent: 78.5, financialExpenditureCr: 76100 },
      { month: 'Dec 2025', plannedPercent: 86.0, actualPercent: 79.4, financialExpenditureCr: 77300 },
      { month: 'Jan 2026', plannedPercent: 88.0, actualPercent: 80.2, financialExpenditureCr: 78100 },
      { month: 'Feb 2026', plannedPercent: 89.5, actualPercent: 81.0, financialExpenditureCr: 78800 },
      { month: 'Mar 2026', plannedPercent: 91.0, actualPercent: 81.4, financialExpenditureCr: 79200 }
    ],
    auditTrail: [
      { id: 'aud-201', date: '2026-02-14', event: 'MoRTH Review Notice: Issued penalty warning to Package 16 EPC contractor.', reportedBy: 'Regional Officer NHAI', type: 'warning' },
      { id: 'aud-202', date: '2025-12-20', event: 'Right of Way (RoW): Received clearance for 12.8 km in Vasai division.', reportedBy: 'Competent Authority Land Acquisition', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-003',
    name: 'Bangalore Metro Phase 2A & 2B (Silk Board to Kempegowda Airport)',
    code: 'UA-BMRCL-PH2-BLR',
    sector: 'Urban Affairs & Metro',
    ministry: 'MoHUA',
    state: 'Karnataka',
    implementingAgency: 'Bangalore Metro Rail Corporation Ltd (BMRCL)',
    location: {
      lat: 13.0827,
      lng: 77.6200,
      city: 'Bengaluru',
      state: 'Karnataka'
    },
    originalCostCr: 14844,
    revisedCostCr: 17250,
    cumulativeExpenditureCr: 9800,
    costOverrunPercent: 16.2,
    originalStartDate: '2021-06-01',
    originalCompletionDate: '2024-12-31',
    revisedCompletionDate: '2026-12-31',
    timeOverrunMonths: 24,
    physicalProgressPercent: 64.5,
    financialProgressPercent: 56.8,
    riskScore: 72,
    riskTier: 'HIGH',
    predictedDelayMonths: 5.8,
    predictedCostEscalationCr: 980,
    confidenceScore: 0.89,
    primaryDelayCause: 'Outer Ring Road traffic diversion constraints, underground utility shifting (BESCOM/BWSSB), and railway overbridge crossing approvals.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-301',
        feature: 'utility_shifting_pending',
        label: 'BWSSB Trunk Water Pipeline Clashes',
        shapValue: 18.2,
        description: 'Major Cauvery water transmission pipes beneath Outer Ring Road piers require night-only micro-tunneling.',
        category: 'Coordination',
        severity: 'critical'
      },
      {
        id: 'rd-302',
        feature: 'urban_traffic_window_hours',
        label: 'Peak Traffic Night-Work Restrictions',
        shapValue: 13.4,
        description: 'Traffic police allows heavy pier-cap crane operations strictly between 11:30 PM and 5:00 AM.',
        category: 'Scope & Design',
        severity: 'high'
      },
      {
        id: 'rd-303',
        feature: 'defense_land_transfer_lag',
        label: 'Yelahanka Air Force Station Land Handover',
        shapValue: 9.8,
        description: 'Final security perimeter wall construction before viaduct entry into Airport terminal zone.',
        category: 'Land Acquisition',
        severity: 'medium'
      },
      {
        id: 'rd-304',
        feature: 'rolling_stock_delivery_lead_time',
        label: 'CBTC Signalling & Driverless Rake Certification',
        shapValue: 7.1,
        description: 'Alstom/BEML prototype testing awaiting depot ramp readiness at Hebbal.',
        category: 'Scope & Design',
        severity: 'medium'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-301',
        action: 'Deploy pre-cast modular utility ducts with specialized BWSSB joint supervision squad',
        timeframe: 'Next 30 Days',
        impact: 'Saves 2.5 months on ORR pier foundations',
        responsibleParty: 'Director (Projects) BMRCL',
        status: 'In Progress',
        riskReductionPoints: 10
      },
      {
        id: 'mit-302',
        action: 'Obtain dedicated Sunday daytime corridor closures from Bengaluru Traffic Police',
        timeframe: 'Immediate',
        impact: 'Increases girder launching speed by 35%',
        responsibleParty: 'Special Commissioner (Traffic) & MD BMRCL',
        status: 'Pending',
        riskReductionPoints: 8
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 68.0, actualPercent: 58.2, financialExpenditureCr: 8800 },
      { month: 'Nov 2025', plannedPercent: 71.0, actualPercent: 60.1, financialExpenditureCr: 9050 },
      { month: 'Dec 2025', plannedPercent: 74.0, actualPercent: 61.8, financialExpenditureCr: 9300 },
      { month: 'Jan 2026', plannedPercent: 77.0, actualPercent: 63.0, financialExpenditureCr: 9550 },
      { month: 'Feb 2026', plannedPercent: 80.0, actualPercent: 64.0, financialExpenditureCr: 9710 },
      { month: 'Mar 2026', plannedPercent: 82.5, actualPercent: 64.5, financialExpenditureCr: 9800 }
    ],
    auditTrail: [
      { id: 'aud-301', date: '2026-02-05', event: 'Audit Alert: Viaduct casting pace 28% below revised master schedule.', reportedBy: 'State High Power Committee', type: 'warning' },
      { id: 'aud-302', date: '2025-12-18', event: 'First pier cap launched on Airport spur package near Bagalur.', reportedBy: 'BMRCL Chief Engineer', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-004',
    name: 'Mumbai-Ahmedabad High-Speed Rail Corridor (Bullet Train)',
    code: 'RLY-NHSRCL-MAHSR-508',
    sector: 'Railways',
    ministry: 'Ministry of Railways',
    state: 'Maharashtra',
    implementingAgency: 'National High Speed Rail Corporation Ltd (NHSRCL)',
    location: {
      lat: 21.1702,
      lng: 72.8311,
      city: 'Surat / Thane',
      state: 'Gujarat / Maharashtra'
    },
    originalCostCr: 108000,
    revisedCostCr: 165000,
    cumulativeExpenditureCr: 72400,
    costOverrunPercent: 52.7,
    originalStartDate: '2017-09-14',
    originalCompletionDate: '2023-12-31',
    revisedCompletionDate: '2027-08-15',
    timeOverrunMonths: 44,
    physicalProgressPercent: 58.3,
    financialProgressPercent: 43.8,
    riskScore: 76,
    riskTier: 'HIGH',
    predictedDelayMonths: 7.2,
    predictedCostEscalationCr: 8400,
    confidenceScore: 0.93,
    primaryDelayCause: 'Maharashtra underground undersea tunnel package C-2 execution, Shinkansen rolling stock procurement price revisions, and BKC station excavation.',
    lastUpdated: '2026-03-03',
    topRiskDrivers: [
      {
        id: 'rd-401',
        feature: 'specialized_undersea_tunnel_tbm',
        label: '21 km Undersea Tunnel Package C-2 TBM Launch',
        shapValue: 22.1,
        description: 'TBM assembly at Ghansoli shaft faces high water pressures and fractured basalt bedrock.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-402',
        feature: 'vendor_currency_forex_exposure',
        label: 'JICA Yen Exchange Rate & Vendor Negotiation',
        shapValue: 16.4,
        description: 'Procurement of modified E5-series bullet train rakes with Kawasaki/Hitachi consortium undergoing commercial re-alignment.',
        category: 'Scope & Design',
        severity: 'high'
      },
      {
        id: 'rd-403',
        feature: 'urban_deep_excavation_bkc',
        label: 'Bandra-Kurla Complex (BKC) 32m Deep Terminal Station',
        shapValue: 12.8,
        description: 'Proximity to Mithi River requires continuous diaphragm wall de-watering and grout injections.',
        category: 'Scope & Design',
        severity: 'high'
      },
      {
        id: 'rd-404',
        feature: 'gujarat_viaduct_speed_cushion',
        label: 'Gujarat Viaduct Full Span Launching Ahead of Target',
        shapValue: -11.5,
        description: 'Over 285 km of viaduct completed seamlessly across Surat, Vadodara, and Anand sections.',
        category: 'Clearances & Approvals',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-401',
        action: 'Mobilize 2 additional 13.1m slurry TBMs from Japanese manufacturer to parallelize Thane Creek boring',
        timeframe: 'Next 60 Days',
        impact: 'Protects 2027 trial deadline for Maharashtra leg',
        responsibleParty: 'MD NHSRCL & Consortium Lead Afcons',
        status: 'In Progress',
        riskReductionPoints: 12
      },
      {
        id: 'mit-402',
        action: 'Finalize bilateral government-to-government procurement framework for rolling stock delivery',
        timeframe: 'Next 30 Days',
        impact: 'Locks in milestone delivery dates for first 6 rakes',
        responsibleParty: 'Railway Board & Ministry of External Affairs',
        status: 'Pending',
        riskReductionPoints: 9
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 57.0, actualPercent: 52.1, financialExpenditureCr: 66000 },
      { month: 'Nov 2025', plannedPercent: 60.0, actualPercent: 54.0, financialExpenditureCr: 68100 },
      { month: 'Dec 2025', plannedPercent: 63.0, actualPercent: 55.4, financialExpenditureCr: 70000 },
      { month: 'Jan 2026', plannedPercent: 66.0, actualPercent: 56.8, financialExpenditureCr: 71200 },
      { month: 'Feb 2026', plannedPercent: 68.5, actualPercent: 57.6, financialExpenditureCr: 71900 },
      { month: 'Mar 2026', plannedPercent: 71.0, actualPercent: 58.3, financialExpenditureCr: 72400 }
    ],
    auditTrail: [
      { id: 'aud-401', date: '2026-02-22', event: 'Shaft 2 excavation reached depth of 36 meters at Vikhroli.', reportedBy: 'Resident Engineer NHSRCL', type: 'milestone' },
      { id: 'aud-402', date: '2025-11-30', event: 'Cabinet Committee approved revised outlay of ₹1,65,000 Cr.', reportedBy: 'Cabinet Secretariat', type: 'audit' }
    ]
  },
  {
    id: 'PRJ-IN-005',
    name: 'Polavaram Multi-Purpose Irrigation & Hydroelectric Project',
    code: 'PWR-PPA-POLA-AP',
    sector: 'Power & Energy',
    ministry: 'Ministry of Jal Shakti',
    state: 'Andhra Pradesh',
    implementingAgency: 'Polavaram Project Authority & APWRD',
    location: {
      lat: 17.2514,
      lng: 81.6521,
      city: 'Eluru / Rajamahendravaram',
      state: 'Andhra Pradesh'
    },
    originalCostCr: 10151,
    revisedCostCr: 55548,
    cumulativeExpenditureCr: 28400,
    costOverrunPercent: 447.2,
    originalStartDate: '2004-04-10',
    originalCompletionDate: '2011-03-31',
    revisedCompletionDate: '2026-11-30',
    timeOverrunMonths: 188,
    physicalProgressPercent: 79.1,
    financialProgressPercent: 51.1,
    riskScore: 84,
    riskTier: 'CRITICAL',
    predictedDelayMonths: 9.1,
    predictedCostEscalationCr: 4100,
    confidenceScore: 0.92,
    primaryDelayCause: 'Diaphragm wall flood damage reconstruction, Rehabilitation & Resettlement (R&R) package funding release, and powerhouse earthworks.',
    lastUpdated: '2026-03-02',
    topRiskDrivers: [
      {
        id: 'rd-501',
        feature: 'rehabilitation_resettlement_backlog',
        label: 'R&R Housing & Land Compensation for 1.06 Lakh Families',
        shapValue: 26.2,
        description: 'Submergence contour 41.15m requires urgent resettlement before monsoon reservoir filling.',
        category: 'Land Acquisition',
        severity: 'critical'
      },
      {
        id: 'rd-502',
        feature: 'geotechnical_structural_failure',
        label: 'Diaphragm Wall (D-Wall) Scour & New Parallel Wall Construction',
        shapValue: 21.0,
        description: 'Godavari flood scour required fresh design vetting by international geotechnical dam safety panel.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-503',
        feature: 'center_state_funding_disbursement',
        label: 'Central Assistance Reimbursement Reimbursement Lag',
        shapValue: 14.3,
        description: 'State government submitted ₹12,911 Cr reimbursement bills pending clearance by Ministry of Finance.',
        category: 'Contractor & Cashflow',
        severity: 'high'
      },
      {
        id: 'rd-504',
        feature: 'spillway_gates_automation',
        label: '48 Radial Gates Hydraulic Hoist Commissioning Complete',
        shapValue: -9.8,
        description: 'Spillway crest gates fully installed with remote control center functional.',
        category: 'Scope & Design',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-501',
        action: 'Tranche release of ₹5,500 Cr dedicated R&R escrow fund direct to beneficiary DBT accounts',
        timeframe: 'Next 30 Days',
        impact: 'Facilitates voluntary relocation before Godavari flood peak',
        responsibleParty: 'Ministry of Jal Shakti & Dept of Expenditure',
        status: 'In Progress',
        riskReductionPoints: 14
      },
      {
        id: 'mit-502',
        action: 'Double-shift construction of Vibro-replacement stone columns for Earth-cum-Rockfill Dam (ECRF) foundation',
        timeframe: 'Next 45 Days',
        impact: 'Pre-empts next monsoon wash-out risk',
        responsibleParty: 'Megha Engineering & APWRD Chief Engineer',
        status: 'In Progress',
        riskReductionPoints: 11
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 82.0, actualPercent: 76.8, financialExpenditureCr: 27100 },
      { month: 'Nov 2025', plannedPercent: 84.0, actualPercent: 77.4, financialExpenditureCr: 27450 },
      { month: 'Dec 2025', plannedPercent: 86.0, actualPercent: 78.0, financialExpenditureCr: 27800 },
      { month: 'Jan 2026', plannedPercent: 88.0, actualPercent: 78.5, financialExpenditureCr: 28100 },
      { month: 'Feb 2026', plannedPercent: 90.0, actualPercent: 78.9, financialExpenditureCr: 28280 },
      { month: 'Mar 2026', plannedPercent: 91.5, actualPercent: 79.1, financialExpenditureCr: 28400 }
    ],
    auditTrail: [
      { id: 'aud-501', date: '2026-02-18', event: 'Central Water Commission (CWC) inspection on D-wall test grouting completed.', reportedBy: 'CWC Chairman', type: 'audit' },
      { id: 'aud-502', date: '2026-01-20', event: 'High Alert: R&R protest in Kunavaram mandal delayed canal lining works.', reportedBy: 'District Collector Alluri', type: 'warning' }
    ]
  },
  {
    id: 'PRJ-IN-006',
    name: 'Western Dedicated Freight Corridor (Dadri to JNPT)',
    code: 'RLY-DFCCIL-WDFC-1506',
    sector: 'Railways',
    ministry: 'Ministry of Railways',
    state: 'Maharashtra',
    implementingAgency: 'Dedicated Freight Corridor Corporation of India (DFCCIL)',
    location: {
      lat: 19.8245,
      lng: 73.1250,
      city: 'Vaitarna / Panvel',
      state: 'Maharashtra'
    },
    originalCostCr: 28181,
    revisedCostCr: 51200,
    cumulativeExpenditureCr: 47900,
    costOverrunPercent: 81.7,
    originalStartDate: '2008-02-01',
    originalCompletionDate: '2016-12-31',
    revisedCompletionDate: '2026-06-30',
    timeOverrunMonths: 114,
    physicalProgressPercent: 91.8,
    financialProgressPercent: 93.5,
    riskScore: 54,
    riskTier: 'MODERATE',
    predictedDelayMonths: 3.2,
    predictedCostEscalationCr: 720,
    confidenceScore: 0.95,
    primaryDelayCause: 'Final 108 km Vaitarna-JNPT coastal bridge spans, railway crossover interlocking, and salt-pan land compensation claims.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-601',
        feature: 'coastal_bridge_span_erection',
        label: 'Vaitarna & Ulhas River Steel Girder Bridges',
        shapValue: 14.8,
        description: 'Tidal currents limit floating barge crane launching windows during high tide cycles.',
        category: 'Geological & Weather',
        severity: 'high'
      },
      {
        id: 'rd-602',
        feature: 'land_compensation_appeals',
        label: 'Salt-Pan Owners Legal Claims in JNPT Hinterland',
        shapValue: 11.2,
        description: 'Compensation enhancement petitions pending in appellate revenue tribunals.',
        category: 'Land Acquisition',
        severity: 'medium'
      },
      {
        id: 'rd-603',
        feature: 'completed_sections_operational',
        label: 'Over 1,300 km from Dadri to Sanjan Operational',
        shapValue: -15.4,
        description: 'Double-stack electric container trains already running daily with heavy revenue generation.',
        category: 'Scope & Design',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-601',
        action: 'Deploy modular cantilever launcher to bypass tidal barge constraints on Vaitarna bridge',
        timeframe: 'Next 30 Days',
        impact: 'Removes weather dependency for 6 critical spans',
        responsibleParty: 'Director (Infra) DFCCIL',
        status: 'In Progress',
        riskReductionPoints: 9
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 92.0, actualPercent: 88.5, financialExpenditureCr: 46100 },
      { month: 'Nov 2025', plannedPercent: 93.5, actualPercent: 89.4, financialExpenditureCr: 46600 },
      { month: 'Dec 2025', plannedPercent: 95.0, actualPercent: 90.3, financialExpenditureCr: 47100 },
      { month: 'Jan 2026', plannedPercent: 96.5, actualPercent: 91.0, financialExpenditureCr: 47500 },
      { month: 'Feb 2026', plannedPercent: 98.0, actualPercent: 91.5, financialExpenditureCr: 47750 },
      { month: 'Mar 2026', plannedPercent: 99.0, actualPercent: 91.8, financialExpenditureCr: 47900 }
    ],
    auditTrail: [
      { id: 'aud-601', date: '2026-02-12', event: 'Commissioning of Gothivali traction substation energization.', reportedBy: 'General Manager DFCCIL', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-007',
    name: 'Zojila Pass Strategic All-Weather Tunnel',
    code: 'RTH-NHIDCL-ZOJ-14KM',
    sector: 'Road Transport & Highways',
    ministry: 'MoRTH',
    state: 'Ladakh / J&K',
    implementingAgency: 'National Highways & Infrastructure Development Corporation (NHIDCL)',
    location: {
      lat: 34.2811,
      lng: 75.7890,
      city: 'Baltal / Dras',
      state: 'Ladakh / J&K'
    },
    originalCostCr: 6800,
    revisedCostCr: 9300,
    cumulativeExpenditureCr: 5200,
    costOverrunPercent: 36.8,
    originalStartDate: '2020-10-15',
    originalCompletionDate: '2026-10-31',
    revisedCompletionDate: '2027-11-30',
    timeOverrunMonths: 13,
    physicalProgressPercent: 54.2,
    financialProgressPercent: 55.9,
    riskScore: 82,
    riskTier: 'CRITICAL',
    predictedDelayMonths: 8.5,
    predictedCostEscalationCr: 1250,
    confidenceScore: 0.90,
    primaryDelayCause: 'Minus 30°C winter freeze halting portal operations, avalanche zone stabilization at Baltal portal, and high overburden rock stress.',
    lastUpdated: '2026-03-03',
    topRiskDrivers: [
      {
        id: 'rd-701',
        feature: 'extreme_climate_operating_freeze',
        label: 'Sub-Zero Winter Freeze & Concrete Curing Ingress',
        shapValue: 24.1,
        description: 'Ambient temperatures below -25°C restrict batching plant operations to heated greenhouse enclosures.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-702',
        feature: 'avalanche_geotechnical_hazard',
        label: 'Baltal Approach Cut-and-Cover Avalanche Sheds',
        shapValue: 18.5,
        description: 'Recurring winter snow avalanches damage portal heavy equipment access road.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-703',
        feature: 'ventilation_shaft_excavation',
        label: 'Vertical Shaft Sinking in Hard Gneiss Rock',
        shapValue: 11.4,
        description: '450m vertical exhaust shaft sinking delayed due to groundwater seepage.',
        category: 'Scope & Design',
        severity: 'high'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-701',
        action: 'Install insulated boiler steam heating systems for all concrete batching plants to maintain 24/7 winter pour',
        timeframe: 'Next 30 Days',
        impact: 'Recovers 4 months of lost winter work annually',
        responsibleParty: 'Project Director MEIL & Executive Director NHIDCL',
        status: 'In Progress',
        riskReductionPoints: 13
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 55.0, actualPercent: 51.0, financialExpenditureCr: 4700 },
      { month: 'Nov 2025', plannedPercent: 58.0, actualPercent: 52.2, financialExpenditureCr: 4850 },
      { month: 'Dec 2025', plannedPercent: 60.0, actualPercent: 52.9, financialExpenditureCr: 4980 },
      { month: 'Jan 2026', plannedPercent: 62.0, actualPercent: 53.4, financialExpenditureCr: 5080 },
      { month: 'Feb 2026', plannedPercent: 64.0, actualPercent: 53.8, financialExpenditureCr: 5140 },
      { month: 'Mar 2026', plannedPercent: 66.0, actualPercent: 54.2, financialExpenditureCr: 5200 }
    ],
    auditTrail: [
      { id: 'aud-701', date: '2026-02-19', event: 'Avalanche early warning system triggered safely evacuated 120 shaft workers.', reportedBy: 'Safety Officer MEIL', type: 'warning' },
      { id: 'aud-702', date: '2025-10-05', event: 'Achieved breakthrough in 6th escape cross-passage passage.', reportedBy: 'NHIDCL Resident Engineer', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-008',
    name: 'Gorakhpur Haryana Anu Vidyut Pariyojana (GHAVP Nuclear 1400MW)',
    code: 'PWR-NPCIL-GHAVP-2X700',
    sector: 'Power & Energy',
    ministry: 'Department of Atomic Energy',
    state: 'Haryana',
    implementingAgency: 'Nuclear Power Corporation of India Ltd (NPCIL)',
    location: {
      lat: 29.5312,
      lng: 75.8710,
      city: 'Fatehabad',
      state: 'Haryana'
    },
    originalCostCr: 20594,
    revisedCostCr: 24800,
    cumulativeExpenditureCr: 16100,
    costOverrunPercent: 20.4,
    originalStartDate: '2014-01-13',
    originalCompletionDate: '2022-06-30',
    revisedCompletionDate: '2027-03-31',
    timeOverrunMonths: 57,
    physicalProgressPercent: 68.2,
    financialProgressPercent: 64.9,
    riskScore: 49,
    riskTier: 'MODERATE',
    predictedDelayMonths: 2.8,
    predictedCostEscalationCr: 540,
    confidenceScore: 0.94,
    primaryDelayCause: 'Indigenous steam generator forging quality approvals, heavy haulage route bridge strengthening from Hazira, and AERB stage clearances.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-801',
        feature: 'statutory_nuclear_safety_clearances',
        label: 'Atomic Energy Regulatory Board (AERB) Vessel Inspections',
        shapValue: 15.2,
        description: 'Reactor pressure vessel weld volumetric ultrasonic testing mandates zero-defect clearance.',
        category: 'Clearances & Approvals',
        severity: 'high'
      },
      {
        id: 'rd-802',
        feature: 'over_dimensional_cargo_transport',
        label: 'Hazira-to-Haryana 700T Heavy Hauler Route Permits',
        shapValue: 11.5,
        description: '28 highway overbridges along golden quadrilateral required temporary shoring props.',
        category: 'Coordination',
        severity: 'medium'
      },
      {
        id: 'rd-803',
        feature: 'cooling_water_canal_ready',
        label: 'Tohana Canal Dedicated Water Intake Fully Completed',
        shapValue: -12.4,
        description: '56 km cooling reservoir pipeline and raw water desilting basins handed over.',
        category: 'Scope & Design',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-801',
        action: 'Fast-track digital twin radiographic inspection validation with AERB Directorate of Regulatory Safety',
        timeframe: 'Next 30 Days',
        impact: 'Curtails inspection waiting window by 6 weeks',
        responsibleParty: 'Director (Operations) NPCIL',
        status: 'In Progress',
        riskReductionPoints: 8
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 69.0, actualPercent: 65.2, financialExpenditureCr: 15100 },
      { month: 'Nov 2025', plannedPercent: 70.5, actualPercent: 66.0, financialExpenditureCr: 15350 },
      { month: 'Dec 2025', plannedPercent: 72.0, actualPercent: 66.8, financialExpenditureCr: 15600 },
      { month: 'Jan 2026', plannedPercent: 73.5, actualPercent: 67.4, financialExpenditureCr: 15820 },
      { month: 'Feb 2026', plannedPercent: 75.0, actualPercent: 67.9, financialExpenditureCr: 15990 },
      { month: 'Mar 2026', plannedPercent: 76.5, actualPercent: 68.2, financialExpenditureCr: 16100 }
    ],
    auditTrail: [
      { id: 'aud-801', date: '2026-01-28', event: 'Installation of Reactor Pressure Calandria Vault 1 completed.', reportedBy: 'Station Director GHAVP', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-009',
    name: 'Dibrugarh-Barauni Natural Gas Pipeline (Urja Ganga Eastern Grid)',
    code: 'PET-GAIL-URJA-720KM',
    sector: 'Petroleum & Gas',
    ministry: 'MoPNG',
    state: 'Assam',
    implementingAgency: 'GAIL (India) Limited & IGGL',
    location: {
      lat: 26.7509,
      lng: 94.2037,
      city: 'Jorhat / Dibrugarh',
      state: 'Assam / Bihar'
    },
    originalCostCr: 5500,
    revisedCostCr: 6850,
    cumulativeExpenditureCr: 5480,
    costOverrunPercent: 24.5,
    originalStartDate: '2019-03-01',
    originalCompletionDate: '2023-08-31',
    revisedCompletionDate: '2026-07-31',
    timeOverrunMonths: 35,
    physicalProgressPercent: 88.5,
    financialProgressPercent: 80.0,
    riskScore: 52,
    riskTier: 'MODERATE',
    predictedDelayMonths: 2.1,
    predictedCostEscalationCr: 210,
    confidenceScore: 0.91,
    primaryDelayCause: 'Horizontal Directional Drilling (HDD) under Brahmaputra river channel, tea garden right of use (RoU), and monsoonal soil inundation.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-901',
        feature: 'river_crossing_hdd_engineering',
        label: '4.2 km Brahmaputra Major HDD Crossing',
        shapValue: 17.1,
        description: 'Shifting sandy riverbed sediment required dual-rig intersecting drill guidance technology.',
        category: 'Geological & Weather',
        severity: 'high'
      },
      {
        id: 'rd-902',
        feature: 'tea_estate_rou_acquisition',
        label: 'Tea Garden Worker Colony RoU Permissions',
        shapValue: 9.8,
        description: 'Tinsukia and Dibrugarh private tea estates negotiating supplementary plantation compensation.',
        category: 'Land Acquisition',
        severity: 'medium'
      },
      {
        id: 'rd-903',
        feature: 'pipe_stringing_welding_pace',
        label: 'Over 620 km Mainline Hydro-tested',
        shapValue: -14.2,
        description: 'Assam gas grid interconnecting stations commissioned at Numaligarh and Guwahati.',
        category: 'Scope & Design',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-901',
        action: 'Deploy specialized German HDD steering team for final 800m pipe pullback across south bank',
        timeframe: 'Next 21 Days',
        impact: 'Completes last pipeline bottleneck before monsoon rains',
        responsibleParty: 'Director (Projects) GAIL',
        status: 'In Progress',
        riskReductionPoints: 9
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 85.0, actualPercent: 83.2, financialExpenditureCr: 5100 },
      { month: 'Nov 2025', plannedPercent: 87.0, actualPercent: 84.8, financialExpenditureCr: 5210 },
      { month: 'Dec 2025', plannedPercent: 89.0, actualPercent: 86.1, financialExpenditureCr: 5320 },
      { month: 'Jan 2026', plannedPercent: 91.0, actualPercent: 87.2, financialExpenditureCr: 5400 },
      { month: 'Feb 2026', plannedPercent: 93.0, actualPercent: 88.0, financialExpenditureCr: 5450 },
      { month: 'Mar 2026', plannedPercent: 95.0, actualPercent: 88.5, financialExpenditureCr: 5480 }
    ],
    auditTrail: [
      { id: 'aud-901', date: '2026-02-10', event: 'Successful pressure hydrotest completed on 74 km Golaghat spur.', reportedBy: 'GAIL Quality Lead', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-010',
    name: 'Vadhavan Greenfield Deep Draft Port',
    code: 'PRT-JNPA-VADH-76K',
    sector: 'Ports & Shipping',
    ministry: 'Ministry of Ports, Shipping and Waterways',
    state: 'Maharashtra',
    implementingAgency: 'Jawaharlal Nehru Port Authority & VPCL',
    location: {
      lat: 19.9822,
      lng: 72.6954,
      city: 'Dahanu / Palghar',
      state: 'Maharashtra'
    },
    originalCostCr: 76220,
    revisedCostCr: 76220,
    cumulativeExpenditureCr: 4100,
    costOverrunPercent: 0.0,
    originalStartDate: '2024-06-20',
    originalCompletionDate: '2030-03-31',
    revisedCompletionDate: '2030-03-31',
    timeOverrunMonths: 0,
    physicalProgressPercent: 12.4,
    financialProgressPercent: 5.4,
    riskScore: 68,
    riskTier: 'HIGH',
    predictedDelayMonths: 4.8,
    predictedCostEscalationCr: 2800,
    confidenceScore: 0.88,
    primaryDelayCause: 'Offshore breakwater dredging environment permits, local artisanal fishermen rehabilitation disputes, and road/rail port connectivity RoW.',
    lastUpdated: '2026-03-02',
    topRiskDrivers: [
      {
        id: 'rd-1001',
        feature: 'crz_environmental_litigation',
        label: 'Dahanu Taluka Environment Protection Authority (DTEPA) Clearance Conditions',
        shapValue: 23.4,
        description: 'Mandatory environmental compliance for 20m natural draft dredging without blasting near marine life habitats.',
        category: 'Clearances & Approvals',
        severity: 'critical'
      },
      {
        id: 'rd-1002',
        feature: 'fishermen_livelihood_settlement',
        label: 'Artisanal Fisheries Welfare & Compensation Package',
        shapValue: 16.8,
        description: 'Public hearings in 14 coastal villages regarding seasonal gill-net fishing rights and alternative harbor construction.',
        category: 'Land Acquisition',
        severity: 'high'
      },
      {
        id: 'rd-1003',
        feature: 'breakwater_rock_sourcing',
        label: '20 Million Cubic Meter Quarry Sourcing Clearances',
        shapValue: 12.1,
        description: 'Bulk basalt armor stone quarry identification across northern Maharashtra districts.',
        category: 'Scope & Design',
        severity: 'medium'
      },
      {
        id: 'rd-1004',
        feature: 'cabinet_statutory_approval',
        label: 'Union Cabinet Final Investment Approval Received',
        shapValue: -15.2,
        description: 'Project designated as National Major Port with ₹76,220 Cr sovereign capital commitment.',
        category: 'Clearances & Approvals',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1001',
        action: 'Conclude tripartite livelihood agreement with Maharashtra Fisheries Department and local cooperative leaders',
        timeframe: 'Next 45 Days',
        impact: 'Enables offshore soil investigation and initial bund reclamation',
        responsibleParty: 'Chairman JNPA & District Collector Palghar',
        status: 'In Progress',
        riskReductionPoints: 11
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 8.0, actualPercent: 7.2, financialExpenditureCr: 2100 },
      { month: 'Nov 2025', plannedPercent: 10.0, actualPercent: 8.5, financialExpenditureCr: 2600 },
      { month: 'Dec 2025', plannedPercent: 12.0, actualPercent: 9.8, financialExpenditureCr: 3100 },
      { month: 'Jan 2026', plannedPercent: 14.0, actualPercent: 10.8, financialExpenditureCr: 3500 },
      { month: 'Feb 2026', plannedPercent: 16.0, actualPercent: 11.6, financialExpenditureCr: 3850 },
      { month: 'Mar 2026', plannedPercent: 18.0, actualPercent: 12.4, financialExpenditureCr: 4100 }
    ],
    auditTrail: [
      { id: 'aud-1001', date: '2026-01-14', event: 'Global tenders issued for Phase 1 offshore reclamation and dredging.', reportedBy: 'VPCL Managing Director', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-011',
    name: 'Patna Ganga 6-Lane Cable-Stayed Bridge (Kacchi Dargah to Bidupur)',
    code: 'RTH-BSRDC-GANGA-PKG',
    sector: 'Road Transport & Highways',
    ministry: 'MoRTH / State Govt',
    state: 'Bihar',
    implementingAgency: 'Bihar State Road Development Corporation (BSRDC)',
    location: {
      lat: 25.6022,
      lng: 85.2410,
      city: 'Patna / Vaishali',
      state: 'Bihar'
    },
    originalCostCr: 4988,
    revisedCostCr: 6550,
    cumulativeExpenditureCr: 4890,
    costOverrunPercent: 31.3,
    originalStartDate: '2016-08-01',
    originalCompletionDate: '2020-02-28',
    revisedCompletionDate: '2026-08-31',
    timeOverrunMonths: 78,
    physicalProgressPercent: 78.4,
    financialProgressPercent: 74.6,
    riskScore: 74,
    riskTier: 'HIGH',
    predictedDelayMonths: 5.1,
    predictedCostEscalationCr: 480,
    confidenceScore: 0.90,
    primaryDelayCause: 'Extended 5-month Ganga flood season halting main-channel pylon work, Bidupur approach embankment land handovers, and joint venture cashflow stress.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-1101',
        feature: 'river_flood_hydrology_interruption',
        label: 'Annual Monsoon Flood Stoppage on Ganga Channel',
        shapValue: 20.5,
        description: 'Swollen water velocity above 3.5 m/s prevents stay-cable tensioning between June and October.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-1102',
        feature: 'approach_road_land_handover',
        label: 'Bidupur Northern Approach 8.5 km Land Disputes',
        shapValue: 15.2,
        description: 'Fragmented agricultural plots in Vaishali district awaiting court settlement disbursements.',
        category: 'Land Acquisition',
        severity: 'high'
      },
      {
        id: 'rd-1103',
        feature: 'contractor_sub_vendor_arrears',
        label: 'Specialized Cable Anchor Subcontractor Payment Delay',
        shapValue: 11.0,
        description: 'International stay-cable specialist demobilized crew in late 2025 due to pending invoices.',
        category: 'Contractor & Cashflow',
        severity: 'high'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1101',
        action: 'Deploy pre-cast segmental erection gantry on northern bank before May 2026 pre-monsoon cutoff',
        timeframe: 'Next 30 Days',
        impact: 'Protects 14 spans from flood shutdown',
        responsibleParty: 'Chief Project Manager BSRDC & Daewoo-L&T JV',
        status: 'In Progress',
        riskReductionPoints: 10
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 77.0, actualPercent: 72.8, financialExpenditureCr: 4500 },
      { month: 'Nov 2025', plannedPercent: 80.0, actualPercent: 74.5, financialExpenditureCr: 4620 },
      { month: 'Dec 2025', plannedPercent: 83.0, actualPercent: 76.1, financialExpenditureCr: 4720 },
      { month: 'Jan 2026', plannedPercent: 86.0, actualPercent: 77.2, financialExpenditureCr: 4800 },
      { month: 'Feb 2026', plannedPercent: 88.5, actualPercent: 77.9, financialExpenditureCr: 4850 },
      { month: 'Mar 2026', plannedPercent: 91.0, actualPercent: 78.4, financialExpenditureCr: 4890 }
    ],
    auditTrail: [
      { id: 'aud-1101', date: '2026-02-17', event: 'Inspection by Road Construction Department Minister on pier P-42.', reportedBy: 'Executive Engineer BSRDC', type: 'warning' }
    ]
  },
  {
    id: 'PRJ-IN-012',
    name: 'Kochi Water Metro Electric Ferry Expansion (Phase 2)',
    code: 'UA-KMRL-WATERMETRO-78',
    sector: 'Urban Affairs & Metro',
    ministry: 'MoHUA / Kerala Govt',
    state: 'Kerala',
    implementingAgency: 'Kochi Metro Rail Ltd (KMRL)',
    location: {
      lat: 9.9312,
      lng: 76.2673,
      city: 'Kochi / Vypin',
      state: 'Kerala'
    },
    originalCostCr: 1137,
    revisedCostCr: 1137,
    cumulativeExpenditureCr: 940,
    costOverrunPercent: 0.0,
    originalStartDate: '2019-11-01',
    originalCompletionDate: '2024-06-30',
    revisedCompletionDate: '2026-06-30',
    timeOverrunMonths: 24,
    physicalProgressPercent: 93.1,
    financialProgressPercent: 82.7,
    riskScore: 28,
    riskTier: 'LOW',
    predictedDelayMonths: 0.8,
    predictedCostEscalationCr: 18,
    confidenceScore: 0.96,
    primaryDelayCause: 'Cochin Shipyard battery cell import supply chain adjustments and minor tidal jetty mooring alignments.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-1201',
        feature: 'battery_cell_import_lead_time',
        label: 'LFP Battery Cell Delivery to Cochin Shipyard',
        shapValue: 6.2,
        description: 'Global maritime lithium-iron-phosphate battery certification required 3 extra weeks.',
        category: 'Scope & Design',
        severity: 'low'
      },
      {
        id: 'rd-1202',
        feature: 'floating_jetty_fabrication',
        label: 'Air-conditioned Pontoon Jetties Commissioned',
        shapValue: -8.5,
        description: '24 of 38 terminals operational with automatic passenger fare gates integrated with Kochi1 card.',
        category: 'Scope & Design',
        severity: 'low'
      },
      {
        id: 'rd-1203',
        feature: 'high_ridership_revenue_surplus',
        label: 'Daily Passenger Ridership Exceeds 28,000 Riders',
        shapValue: -11.4,
        description: 'Operational cash flows cover 100% of route running and battery charging power costs.',
        category: 'Contractor & Cashflow',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1201',
        action: 'Commission remaining 5 rapid DC water-charging pantographs at Fort Kochi and Mattancherry terminals',
        timeframe: 'Next 30 Days',
        impact: 'Brings full fleet utilization to 40 electric vessels',
        responsibleParty: 'Chief Operating Officer KMRL',
        status: 'Completed',
        riskReductionPoints: 5
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 90.0, actualPercent: 89.0, financialExpenditureCr: 880 },
      { month: 'Nov 2025', plannedPercent: 91.5, actualPercent: 90.2, financialExpenditureCr: 900 },
      { month: 'Dec 2025', plannedPercent: 93.0, actualPercent: 91.4, financialExpenditureCr: 915 },
      { month: 'Jan 2026', plannedPercent: 94.5, actualPercent: 92.1, financialExpenditureCr: 925 },
      { month: 'Feb 2026', plannedPercent: 96.0, actualPercent: 92.8, financialExpenditureCr: 935 },
      { month: 'Mar 2026', plannedPercent: 97.0, actualPercent: 93.1, financialExpenditureCr: 940 }
    ],
    auditTrail: [
      { id: 'aud-1201', date: '2026-02-25', event: 'Launch of commercial ferry operations on High Court to Kumbalangi tourist line.', reportedBy: 'MD KMRL', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-013',
    name: 'Char Dham All-Weather Highway Connectivity Project',
    code: 'RTH-MORTH-CHARDHAM-900KM',
    sector: 'Road Transport & Highways',
    ministry: 'MoRTH',
    state: 'Uttarakhand',
    implementingAgency: 'Border Roads Organisation (BRO) & NHIDCL',
    location: {
      lat: 30.5524,
      lng: 79.1762,
      city: 'Rudraprayag / Chamoli',
      state: 'Uttarakhand'
    },
    originalCostCr: 12070,
    revisedCostCr: 16800,
    cumulativeExpenditureCr: 13450,
    costOverrunPercent: 39.2,
    originalStartDate: '2016-12-27',
    originalCompletionDate: '2020-12-31',
    revisedCompletionDate: '2026-10-31',
    timeOverrunMonths: 70,
    physicalProgressPercent: 84.1,
    financialProgressPercent: 80.1,
    riskScore: 81,
    riskTier: 'CRITICAL',
    predictedDelayMonths: 7.8,
    predictedCostEscalationCr: 1450,
    confidenceScore: 0.93,
    primaryDelayCause: 'Fragile Himalayan hill slope destabilization, recurrent active landslide chronic zones (Sirobagarh, Helang), and Supreme Court High-Powered Committee slope directives.',
    lastUpdated: '2026-03-02',
    topRiskDrivers: [
      {
        id: 'rd-1301',
        feature: 'himalayan_slope_failure_frequency',
        label: 'Chronic Active Landslide Zones & Mudslides',
        shapValue: 24.3,
        description: 'Sirobagarh, Lambagarh, and Helang slide zones require rock-bolting, hydro-seeding, and debris galleries.',
        category: 'Geological & Weather',
        severity: 'critical'
      },
      {
        id: 'rd-1302',
        feature: 'supreme_court_hpc_restrictions',
        label: 'Carriageway Width & Tree Cutting Ceilings',
        shapValue: 16.5,
        description: 'Strict limits on vertical rock cutting to prevent micro-fissuring of fragile sedimentary stratigraphy.',
        category: 'Clearances & Approvals',
        severity: 'high'
      },
      {
        id: 'rd-1303',
        feature: 'tunnel_bypass_silkyara_remedial',
        label: 'Silkyara-Barkot Tunnel Safety Redesign',
        shapValue: 13.7,
        description: 'Comprehensive escape passage and real-time micro-seismic sensors installation after collapse.',
        category: 'Scope & Design',
        severity: 'high'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1301',
        action: 'Deploy Swiss slope stabilization flexible barrier nets and reinforced concrete avalanche/debris sheds at top 8 chronic slide zones',
        timeframe: 'Next 45 Days',
        impact: 'Ensures round-the-year passage during pilgrim season',
        responsibleParty: 'Director General BRO & Chief Engineer Project Shivalik',
        status: 'In Progress',
        riskReductionPoints: 13
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 82.0, actualPercent: 79.5, financialExpenditureCr: 12600 },
      { month: 'Nov 2025', plannedPercent: 84.0, actualPercent: 81.0, financialExpenditureCr: 12900 },
      { month: 'Dec 2025', plannedPercent: 86.0, actualPercent: 82.2, financialExpenditureCr: 13150 },
      { month: 'Jan 2026', plannedPercent: 88.0, actualPercent: 83.1, financialExpenditureCr: 13300 },
      { month: 'Feb 2026', plannedPercent: 89.5, actualPercent: 83.8, financialExpenditureCr: 13400 },
      { month: 'Mar 2026', plannedPercent: 91.0, actualPercent: 84.1, financialExpenditureCr: 13450 }
    ],
    auditTrail: [
      { id: 'aud-1301', date: '2026-02-16', event: 'Geological survey team cleared 12 km Joshimath bypass alignment.', reportedBy: 'Geological Survey of India (GSI)', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-014',
    name: 'Rewa Ultra Mega Solar Park & Inter-State Grid Augmentation',
    code: 'PWR-RUMSL-REWA-750MW',
    sector: 'Power & Energy',
    ministry: 'Ministry of New and Renewable Energy',
    state: 'Madhya Pradesh',
    implementingAgency: 'Rewa Ultra Mega Solar Ltd (RUMSL) & PGCIL',
    location: {
      lat: 24.5362,
      lng: 81.3037,
      city: 'Rewa / Gurh',
      state: 'Madhya Pradesh'
    },
    originalCostCr: 4500,
    revisedCostCr: 4500,
    cumulativeExpenditureCr: 4420,
    costOverrunPercent: 0.0,
    originalStartDate: '2017-04-17',
    originalCompletionDate: '2020-01-31',
    revisedCompletionDate: '2026-05-31',
    timeOverrunMonths: 76,
    physicalProgressPercent: 97.8,
    financialProgressPercent: 98.2,
    riskScore: 21,
    riskTier: 'LOW',
    predictedDelayMonths: 0.4,
    predictedCostEscalationCr: 0,
    confidenceScore: 0.98,
    primaryDelayCause: 'Inter-state dedicated green energy corridor substation expansion and static synchronous compensator (STATCOM) calibration.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-1401',
        feature: 'statcom_grid_stability_calibration',
        label: 'High Voltage STATCOM Reactive Power Tuning',
        shapValue: 5.1,
        description: 'Ensuring zero harmonics injection into Delhi Metro Rail Corporation (DMRC) green traction feed.',
        category: 'Scope & Design',
        severity: 'low'
      },
      {
        id: 'rd-1402',
        feature: 'clean_payment_security_mechanism',
        label: 'Tier-1 PPA Payment Security Mechanism Active',
        shapValue: -14.8,
        description: 'Letters of credit from MPPMCL and DMRC guarantee immediate 15-day tariff settlement.',
        category: 'Contractor & Cashflow',
        severity: 'low'
      },
      {
        id: 'rd-1403',
        feature: 'full_land_fenced_handover',
        label: '100% Contiguous Revenue Land Handover Cleared',
        shapValue: -16.2,
        description: 'Zero pending RoW or encroachment issues on entire 1,590 hectare park site.',
        category: 'Land Acquisition',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1401',
        action: 'Finalize PGCIL SCADA load dispatcher integration at Jabalpur Regional Load Despatch Centre',
        timeframe: 'Next 14 Days',
        impact: 'Enables 100% peak generation export to national grid',
        responsibleParty: 'Chief Operating Officer RUMSL & PGCIL',
        status: 'In Progress',
        riskReductionPoints: 4
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 96.0, actualPercent: 95.8, financialExpenditureCr: 4320 },
      { month: 'Nov 2025', plannedPercent: 97.0, actualPercent: 96.5, financialExpenditureCr: 4360 },
      { month: 'Dec 2025', plannedPercent: 98.0, actualPercent: 97.0, financialExpenditureCr: 4390 },
      { month: 'Jan 2026', plannedPercent: 98.5, actualPercent: 97.4, financialExpenditureCr: 4405 },
      { month: 'Feb 2026', plannedPercent: 99.0, actualPercent: 97.6, financialExpenditureCr: 4415 },
      { month: 'Mar 2026', plannedPercent: 100.0, actualPercent: 97.8, financialExpenditureCr: 4420 }
    ],
    auditTrail: [
      { id: 'aud-1401', date: '2026-02-20', event: 'DMRC audited zero carbon credits issuance verified for 345 GWh consumption.', reportedBy: 'DMRC Environment Bureau', type: 'milestone' }
    ]
  },
  {
    id: 'PRJ-IN-015',
    name: 'Chennai Metro Rail Phase 2 (Corridor 3 Madhavaram to SIPCOT)',
    code: 'UA-CMRL-PH2-CORR3-118KM',
    sector: 'Urban Affairs & Metro',
    ministry: 'MoHUA / Tamil Nadu Govt',
    state: 'Tamil Nadu',
    implementingAgency: 'Chennai Metro Rail Ltd (CMRL)',
    location: {
      lat: 13.0827,
      lng: 80.2707,
      city: 'Chennai / OMR',
      state: 'Tamil Nadu'
    },
    originalCostCr: 61843,
    revisedCostCr: 63246,
    cumulativeExpenditureCr: 21500,
    costOverrunPercent: 2.3,
    originalStartDate: '2020-02-15',
    originalCompletionDate: '2026-12-31',
    revisedCompletionDate: '2027-10-31',
    timeOverrunMonths: 10,
    physicalProgressPercent: 44.8,
    financialProgressPercent: 34.0,
    riskScore: 62,
    riskTier: 'HIGH',
    predictedDelayMonths: 3.9,
    predictedCostEscalationCr: 920,
    confidenceScore: 0.91,
    primaryDelayCause: 'Underground TBM cutterhead wear in charnockite hard rock beneath Old Mahabalipuram Road (OMR) and utility line diversions.',
    lastUpdated: '2026-03-01',
    topRiskDrivers: [
      {
        id: 'rd-1501',
        feature: 'hard_rock_charnockite_geology',
        label: 'Charnockite & Mixed Ground TBM Cutterhead Abrasion',
        shapValue: 16.8,
        description: 'TBMs require hyperbaric interventions every 45 meters due to high silica abrasive rock.',
        category: 'Geological & Weather',
        severity: 'high'
      },
      {
        id: 'rd-1502',
        feature: 'it_corridor_omr_traffic_divergence',
        label: 'OMR IT Expressway Elevated Pier Space Constraints',
        shapValue: 12.4,
        description: 'Dual-deck elevated viaduct with vehicular flyover requires complex precast launching girders.',
        category: 'Scope & Design',
        severity: 'medium'
      },
      {
        id: 'rd-1503',
        feature: 'multilateral_funding_jica_adb',
        label: 'Multilateral JICA & ADB Financing Tranches Released Smoothly',
        shapValue: -11.2,
        description: 'Low sovereign interest loans disburse on scheduled milestone verifications.',
        category: 'Contractor & Cashflow',
        severity: 'low'
      }
    ],
    mitigationRoadmap: [
      {
        id: 'mit-1501',
        action: 'Deploy tungsten-carbide disc cutters on 4 Robbins TBMs operating in OMR south package',
        timeframe: 'Next 30 Days',
        impact: 'Accelerates tunneling advance rate from 6m/day to 11m/day',
        responsibleParty: 'Director (Projects) CMRL & EPC Consortium Larsen & Toubro',
        status: 'In Progress',
        riskReductionPoints: 9
      }
    ],
    monthlyTrend: [
      { month: 'Oct 2025', plannedPercent: 45.0, actualPercent: 39.5, financialExpenditureCr: 18200 },
      { month: 'Nov 2025', plannedPercent: 47.5, actualPercent: 40.8, financialExpenditureCr: 19100 },
      { month: 'Dec 2025', plannedPercent: 50.0, actualPercent: 42.0, financialExpenditureCr: 19950 },
      { month: 'Jan 2026', plannedPercent: 52.5, actualPercent: 43.1, financialExpenditureCr: 20600 },
      { month: 'Feb 2026', plannedPercent: 55.0, actualPercent: 44.0, financialExpenditureCr: 21100 },
      { month: 'Mar 2026', plannedPercent: 57.5, actualPercent: 44.8, financialExpenditureCr: 21500 }
    ],
    auditTrail: [
      { id: 'aud-1501', date: '2026-02-24', event: 'Successful breakthrough of TBM Kaveri at Chetpet station cross-over.', reportedBy: 'CMRL Chief Public Relations Officer', type: 'milestone' }
    ]
  }
];

export const DEMO_USER_ROLES = [
  {
    id: 'role-mospi',
    name: 'Dr. Alok Verma, IAS',
    title: 'Additional Secretary (Infrastructure Monitoring)',
    department: 'Ministry of Statistics and Programme Implementation (MoSPI)',
    badge: 'MoSPI National Oversight'
  },
  {
    id: 'role-pmg',
    name: 'Priyanka Sen, IRTS',
    title: 'Joint Director',
    department: "Prime Minister's Project Monitoring Group (PMG)",
    badge: 'Cabinet PMG Portal'
  },
  {
    id: 'role-nhai',
    name: 'Rajesh K. Meena',
    title: 'Chief General Manager (Risk & Tech)',
    department: 'National Highways Authority of India (NHAI)',
    badge: 'Executing Agency'
  },
  {
    id: 'role-judge',
    name: 'SIH 2026 Evaluation Jury',
    title: 'Senior Technical Evaluator',
    department: 'Smart India Hackathon 2026 Expert Panel',
    badge: 'Judge Demo Mode'
  }
];

export function computePortfolioKPIs(projects: Project[]): PortfolioKPIs {
  const totalProjects = projects.length;
  let criticalProjects = 0;
  let highRiskProjects = 0;
  let moderateRiskProjects = 0;
  let lowRiskProjects = 0;
  let totalBudgetCr = 0;
  let budgetAtRiskCr = 0;
  let totalDelayMonths = 0;
  let totalCostEscalationPercent = 0;

  for (const p of projects) {
    totalBudgetCr += p.revisedCostCr;
    totalDelayMonths += p.timeOverrunMonths;
    totalCostEscalationPercent += p.costOverrunPercent;

    if (p.riskTier === 'CRITICAL') {
      criticalProjects++;
      budgetAtRiskCr += p.revisedCostCr;
    } else if (p.riskTier === 'HIGH') {
      highRiskProjects++;
      budgetAtRiskCr += p.revisedCostCr * 0.65;
    } else if (p.riskTier === 'MODERATE') {
      moderateRiskProjects++;
      budgetAtRiskCr += p.revisedCostCr * 0.25;
    } else {
      lowRiskProjects++;
      budgetAtRiskCr += p.revisedCostCr * 0.05;
    }
  }

  return {
    totalProjects,
    criticalProjects,
    highRiskProjects,
    moderateRiskProjects,
    lowRiskProjects,
    totalBudgetCr: Math.round(totalBudgetCr),
    budgetAtRiskCr: Math.round(budgetAtRiskCr),
    averageDelayMonths: totalProjects > 0 ? Math.round((totalDelayMonths / totalProjects) * 10) / 10 : 0,
    averageCostEscalationPercent: totalProjects > 0 ? Math.round((totalCostEscalationPercent / totalProjects) * 10) / 10 : 0,
    activeEscalationsCount: criticalProjects + highRiskProjects
  };
}
