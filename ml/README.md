# PRISM Machine Learning & Predictive Analytics Architecture

## 1. Dual Intelligence Paradigm

PRISM operates on an intellectually rigorous, auditable architecture designed for national public governance:

```text
+-----------------------------------------------------------------------------------------+
|                                    PRISM INTELLIGENCE                                   |
+-----------------------------------------------------------------------------------------+
| [Layer 1] Current Health & Prioritization (Production Core):                            |
|   -> 100% Deterministic PRISM Risk Engine (6 Indicators, 0-100 MCDA Score)              |
|   -> Priority Intervention Engine (P1/P2/P3 Action Queue)                               |
|   -> Early Warning Radar (1,036 Anomaly Alerts)                                         |
|                                                                                         |
| [Layer 2] Forward-Looking Project Forecast:                                             |
|   -> Earned Schedule & EAC Forecasting (ISO 21508 EVM)                                  |
|   -> Extrapolates monthly progress velocity and expenditure divergence                  |
|                                                                                         |
| [Layer 3] Empirical Machine Learning Benchmark & SIH26103 CUF Ablation:                 |
|   -> ml/train_real_models.py                                                            |
|   -> Trained on 7,499 longitudinal MoSPI PAIMANA observations across 2,054 projects     |
|   -> Group-stratified train/test validation eliminating observation leakage             |
|   -> Model A (CUF-only) vs Model B (CUF + Engineered) attribution analysis              |
+-----------------------------------------------------------------------------------------+
```

---

## 2. SIH26103 Requirement: Common Upload Form (CUF) Attribution

The Smart India Hackathon 2026 Problem Statement **SIH26103** explicitly specifies:

> *"Development of prediction and analytical models based on the existing Common Upload Form (CUF) fields... along with an assessment of the extent to which predictive performance is attributable to the current CUF fields vis-à-vis additional variables not presently captured in the CUF."*

### CUF Feature Mapping Table

Under MoSPI's Online Central Monitoring System (OCMS) / PAIMANA, executing agencies upload progress updates via the standardized **Common Upload Form (CUF)**. The table below delineates native CUF input fields versus derived/engineered indicators:

| Feature | Native CUF Field? | Raw / Derived | Source Field / Derivation Formula | Used in Model? |
| :--- | :---: | :---: | :--- | :---: |
| `original_cost_cr` | **Yes** | Raw | CUF Sanction / Original Cost (₹ Crore) | Models A & B |
| `revised_cost_cr` | **Yes** | Raw | CUF Anticipated / Revised Cost (₹ Crore) | Models A & B |
| `cumulative_expenditure_cr` | **Yes** | Raw | CUF Cumulative Financial Expenditure (₹ Crore) | Models A & B |
| `physical_progress_pct` | **Yes** | Raw | CUF Cumulative Physical Progress Percentage | Models A & B |
| `expenditure_pct_of_revised_cost` | No | Derived | `(cumulative_expenditure_cr / revised_cost_cr) * 100` | Model B |
| `progress_expenditure_gap` | No | Derived | `physical_progress_pct - expenditure_pct_of_revised_cost` | Model B |
| `cost_revision_pct` | No | Derived | `((revised_cost_cr - original_cost_cr) / original_cost_cr) * 100` | Model B |
| `derived_sector` | No | Derived | NLP text extraction from agency & project title into 9 core infrastructure sectors | Model B (One-Hot) |
| `time_overrun_months` | No | Target | `revised_target_completion_mm_yyyy - original_target_completion_mm_yyyy` | Target Variable |

---

## 3. Empirical CUF Ablation Study (Model A vs. Model B)

To determine the exact extent to which predictive performance is attributable to native CUF fields versus additional engineered variables, `ml/train_real_models.py` executes an identical, group-stratified experimental ablation:

- **Target Variable:** `time_overrun_months` (months of delay).
- **Cross-Validation Split:** `GroupShuffleSplit(n_splits=1, test_size=0.20, random_state=42)` grouped strictly on `project_id`. This guarantees that observations from the same project cannot leak between training and testing sets.
- **Model Architecture:** `GradientBoostingRegressor(n_estimators=100, max_depth=4, learning_rate=0.08, random_state=42)` across both runs.

### Empirical Results

| Metric | Model A: Native CUF Fields Only | Model B: CUF + Engineered Indicators | Incremental Improvement ($\Delta$) |
| :--- | :---: | :---: | :---: |
| **Mean Absolute Error (MAE)** | **16.52 months** | **15.46 months** | **-1.05 months (6.4% relative gain)** |
| **Root Mean Squared Error (RMSE)** | **25.46 months** | **24.89 months** | **-0.57 months** |
| **Coefficient of Determination ($R^2$)** | **0.245** | **0.279** | **+0.033 variance explained** |
| **Feature Set Size** | 4 raw fields | 16 features (including sector dummies) | +12 indicators |

### Top Delay Predictors in Full Model (Gini Importance)

1. **`physical_progress_pct`** (32.0%): Current cumulative completion is the strongest anchor for remaining schedule risk.
2. **`cost_revision_pct`** (19.0%): Magnitude of sanctioned budget expansion signals underlying scope destabilization.
3. **`original_cost_cr`** (13.8%): Scale of project sanctions; mega-projects systematically face larger execution friction.
4. **`expenditure_pct_of_revised_cost`** (10.3%): Financial drawdown rate relative to authorized capital.
5. **`progress_expenditure_gap`** (8.1%): Physical-financial divergence indicating capital disbursement ahead of physical milestones.
6. **`revised_cost_cr`** (7.3%): Anticipated final project cost.
7. **`cumulative_expenditure_cr`** (4.9%): Absolute funds absorbed to date.
8. **`sec_Railways`** (1.9%): Sector-specific linear asset execution constraints.

### Scientific & Governance Attribution Limitations

> **Causal Attribution Disclaimer:** The ablation indicates the incremental associative predictive contribution of engineered variables under this evaluation setup. It does not claim that engineered features "cause" delay or project turnaround, but rather that synthesizing financial absorption ratios, physical-financial divergence, and sector context allows the model to capture non-linear failure modes that single-snapshot raw CUF figures cannot express.

Verified ablation metadata is saved in `ml/artifacts/real_model_metadata.json`.

---

## 4. Why PRISM Uses Deterministic Scoring in Production

In public infrastructure administration (MoSPI, PMG, Cabinet Secretariat), decisions concerning statutory project escalations cannot rely on black-box predictions. Public audit bodies (CAG) demand:
- **Traceability:** Exactly why a project scored 73 vs 52 (e.g., `[Progress Stagnation] 3 consecutive stagnant months`).
- **Repeatability:** Identical inputs must yield identical scores across reporting intervals.
- **Fairness:** Zero algorithmic bias across states, sectors, or contractors.

Therefore, PRISM uses the **deterministic 6-indicator PRISM Risk Engine** as the primary decision-support layer, supplemented by **Earned Schedule forecasting** and empirical regression benchmarks.
