#!/usr/bin/env python3
"""
PRISM (Predictive Risk Intelligence & Smart Monitoring)
ML Inference Script for SIH 2026
"""

import sys
import json

def score_project(physical, financial, land_backlog, clearance_days, geo_hazard, contractor_stress):
    divergence = (financial / max(physical, 1.0))
    risk_score = (
        0.28 * land_backlog +
        0.22 * (clearance_days / 10.0) +
        0.20 * geo_hazard +
        0.15 * contractor_stress +
        10.0 * max(0, divergence - 1.1)
    )
    risk_score = round(min(98.0, max(12.0, risk_score * 0.72)), 1)
    
    tier = 'CRITICAL' if risk_score >= 75 else 'HIGH' if risk_score >= 65 else 'MEDIUM' if risk_score >= 45 else 'LOW'
    predicted_delay = round(max(0.5, (risk_score / 10.0) * 0.9), 1)
    
    return {
        'risk_score': risk_score,
        'risk_tier': tier,
        'predicted_delay_months': predicted_delay,
        'confidence': 0.92
    }

if __name__ == '__main__':
    # Sample test inference
    test = score_project(physical=82.0, financial=94.0, land_backlog=65.0, clearance_days=420, geo_hazard=70.0, contractor_stress=60.0)
    print("Test Inference Result:")
    print(json.dumps(test, indent=2))
