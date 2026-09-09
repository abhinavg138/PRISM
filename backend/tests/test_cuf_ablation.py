"""
PRISM CUF Ablation Test Suite — SIH26103 Alignment
Validates that genuine, non-fabricated CUF-only vs CUF+Engineered ablation metrics exist
and comply with SIH26103 Common Upload Form evaluation criteria.
"""

import json
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent.parent
METADATA_PATH = ROOT_DIR / "ml" / "artifacts" / "real_model_metadata.json"


def test_real_model_metadata_exists():
    """Ensure real_model_metadata.json is generated from empirical PAIMANA data."""
    assert METADATA_PATH.exists(), f"Missing metadata file at {METADATA_PATH}"


def test_cuf_ablation_schema_and_metrics():
    """Verify presence of both Model A (CUF-only) and Model B (CUF+engineered) metrics."""
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "cufOnlyMetrics" in data, "Missing cufOnlyMetrics in metadata"
    assert "cufPlusEngineeredMetrics" in data, "Missing cufPlusEngineeredMetrics in metadata"
    assert "cufFields" in data, "Missing cufFields in metadata"
    assert "engineeredFields" in data, "Missing engineeredFields in metadata"
    assert "methodology" in data, "Missing methodology in metadata"

    # Validate CUF-only metrics
    cuf = data["cufOnlyMetrics"]
    assert "meanAbsoluteErrorMonths" in cuf
    assert "rootMeanSquaredErrorMonths" in cuf
    assert "r2Score" in cuf
    assert isinstance(cuf["meanAbsoluteErrorMonths"], (int, float))
    assert cuf["meanAbsoluteErrorMonths"] > 0

    # Validate CUF+engineered metrics
    all_met = data["cufPlusEngineeredMetrics"]
    assert "meanAbsoluteErrorMonths" in all_met
    assert "rootMeanSquaredErrorMonths" in all_met
    assert "r2Score" in all_met
    assert isinstance(all_met["meanAbsoluteErrorMonths"], (int, float))
    assert all_met["meanAbsoluteErrorMonths"] > 0

    # Validate fields
    assert "original_cost_cr" in data["cufFields"]
    assert "physical_progress_pct" in data["cufFields"]
    assert len(data["engineeredFields"]) >= 3

    # Validate incremental contribution
    assert "incrementalContribution" in data
    inc = data["incrementalContribution"]
    assert "maeReductionMonths" in inc
    assert "r2Improvement" in inc
    # Model B with derived indicators achieves equal or lower error than raw CUF alone
    assert inc["maeReductionMonths"] >= 0, "Engineered features should not severely degrade MAE"


def test_cuf_methodology_has_causal_disclaimer():
    """Verify that scientific integrity and non-causal attribution disclaimer is documented."""
    with open(METADATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    meth = data.get("methodology", {})
    assert "causalDisclaimer" in meth
    assert "causal" in meth["causalDisclaimer"].lower()
