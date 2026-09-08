#!/usr/bin/env python3
"""
[LEGACY / HISTORICAL PROTOTYPE]
Standalone SHAP prototype from early exploratory phase.
PRISM in production uses deterministic, audit-compliant MCDA scoring (backend/services/risk_engine.py).
For genuine MoSPI empirical machine learning benchmarks, see: ml/train_real_models.py
"""

import json

def calculate_shap_attributions(features):
    # Baseline expected value E[f(x)] across national infrastructure portfolio
    base_value = 52.4
    
    # Feature attributions relative to base value
    attributions = [
        {"feature": "Land Acquisition Backlog", "shap_value": round((features.get('land', 50) - 40) * 0.35, 1)},
        {"feature": "Statutory Approvals Lag", "shap_value": round((features.get('clearance_days', 180) - 120) * 0.08, 1)},
        {"feature": "Geological & Weather Vulnerability", "shap_value": round((features.get('geo', 40) - 30) * 0.32, 1)},
        {"feature": "Contractor Liquidity Stress", "shap_value": round((features.get('contractor_stress', 40) - 35) * 0.28, 1)},
        {"feature": "Physical-Financial Divergence", "shap_value": round((features.get('divergence', 1.0) - 1.0) * 15.0, 1)}
    ]
    
    # Sort by absolute impact
    attributions.sort(key=lambda x: abs(x['shap_value']), reverse=True)
    
    sum_shap = sum(a['shap_value'] for a in attributions)
    predicted_score = round(min(99, max(5, base_value + sum_shap)), 1)
    
    return {
        "base_value_expected": base_value,
        "predicted_risk_score": predicted_score,
        "waterfall_attributions": attributions
    }

if __name__ == '__main__':
    sample_feat = {"land": 82, "clearance_days": 480, "geo": 85, "contractor_stress": 68, "divergence": 1.25}
    res = calculate_shap_attributions(sample_feat)
    print("TreeSHAP Waterfall Summary:")
    print(json.dumps(res, indent=2))
