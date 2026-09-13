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
| [Layer 3] Empirical Machine Learning Benchmark & SIH26103 Ablation Pipeline:            |
|   -> ml/train_real_models.py                                                            |
|   -> Trained on 7,499 longitudinal MoSPI PAIMANA observations across 2,054 projects     |
|   -> Group-stratified train/test validation eliminating observation leakage             |
|   -> Requirement (b): Conventional OLS Baseline vs. Tree-Based ML (Gradient Boosting)   |
|   -> Requirement (c): Native CUF-Only (Model A) vs. CUF + Engineered (Model B)          |
+-----------------------------------------------------------------------------------------+
```

---

## 2. ML vs. Conventional Statistical Methods (SIH26103 Requirement b)

The Smart India Hackathon 2026 Problem Statement **SIH26103** explicitly specifies technical dimension (b):

> *"Assessment of whether Artificial Intelligence (AI) and Machine Learning (ML) techniques provide significant gains over conventional statistical methods in terms of prediction accuracy, early warning capabilities and decision-support for infrastructure project monitoring."*

To answer this question empirically rather than theoretically, [`ml/train_real_models.py`](train_real_models.py) trains and evaluates three models on the exact same train/test partition:
1. **Conventional Statistical Baseline:** Ordinary Least Squares (OLS) Linear Regression fitted strictly on native Common Upload Form (CUF) fields.
2. **Model A (Machine Learning — CUF Only):** `GradientBoostingRegressor` fitted strictly on native CUF fields.
3. **Model B (Machine Learning — CUF + Engineered):** `GradientBoostingRegressor` fitted on native CUF fields, derived relational ratios, and one-hot sector classifications.

All three models predict project delay in months (`time_overrun_months`) and are evaluated on an identical 80/20 `GroupShuffleSplit` partitioned strictly by `project_id` (1,497 held-out test observations) to eliminate temporal observation leakage across monthly snapshots.

### Three-Way Empirical Comparison Table

| Model Class | Methodology & Model Description | Feature Set | MAE (months) | RMSE (months) | Explained Variance ($R^2$) |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Conventional Statistical Baseline** | Ordinary Least Squares (OLS) Linear Regression | Native CUF Only (4 fields) | **16.82** | **26.41** | **0.188** |
| **Model A: Machine Learning** | Gradient Boosting Regressor (100 trees, depth 4) | Native CUF Only (4 fields) | **16.52** | **25.46** | **0.245** |
| **Model B: Machine Learning + Engineering** | Gradient Boosting Regressor (100 trees, depth 4) | CUF + Engineered + Sectors (16 features) | **15.46** | **24.89** | **0.279** |

*(Verified empirically from [`ml/artifacts/real_model_metadata.json`](artifacts/real_model_metadata.json) generated from 7,499 PAIMANA snapshot records across 2,054 unique projects).*

### Incremental Performance Breakdown

```text
+---------------------------------------------------------------------------------------------+
| 1. ML vs. Conventional Statistics on Identical CUF Data (Model A vs. OLS Baseline):         |
|    - MAE Reduction:   -0.30 months (16.82 -> 16.52 mo, 1.8% relative error reduction)       |
|    - RMSE Reduction:  -0.95 months (26.41 -> 25.46 mo, 3.6% relative error reduction)       |
|    - R2 Variance Gain: +0.057 (0.188 -> 0.245, +30.3% relative gain in variance captured)   |
|                                                                                             |
| 2. Full ML + Feature Engineering vs. Conventional Statistics (Model B vs. OLS Baseline):    |
|    - MAE Reduction:   -1.36 months (16.82 -> 15.46 mo, 8.1% relative error reduction)       |
|    - RMSE Reduction:  -1.52 months (26.41 -> 24.89 mo, 5.8% relative error reduction)       |
|    - R2 Variance Gain: +0.091 (0.188 -> 0.279, +48.4% relative gain in variance captured)   |
+---------------------------------------------------------------------------------------------+
```

### Honest Scientific & Operational Interpretation

The empirical data yields clear, nuanced answers to the three facets of Requirement (b):

1. **Prediction Accuracy: Modest Gains from Algorithm, Meaningful Gains from Domain Engineering**
   - When restricted to identical raw CUF fields, moving from a conventional linear model (OLS) to a non-linear ensemble (Gradient Boosting) achieves only a **1.8% reduction in MAE** (~9 days on a ~16-month delay baseline). OLS already captures the primary linear trend between cumulative physical progress and schedule slippage (OLS coefficient for `physical_progress_pct` = $+0.334$).
   - However, Gradient Boosting captures non-linear boundary conditions that OLS misses, improving explained variance ($R^2$) by **+30.3%** (0.188 to 0.245).
   - The decisive gain occurs only when non-linear ML is combined with domain feature engineering (Model B), reducing MAE by **1.36 months (8.1%)** and boosting $R^2$ to **0.279 (+48.4% over baseline)**.

2. **Early Warning Capabilities: ML Excels at Identifying Multi-Variable Interaction Risk**
   - Linear statistical methods evaluate individual covariates independently, struggling to flag projects where individual metrics appear benign but their combination is toxic (e.g., high expenditure paired with low physical progress).
   - Gradient boosted trees automatically identify these interaction effects. As shown in the feature importance analysis, derived interaction variables (`cost_revision_pct`, `progress_expenditure_gap`, and `expenditure_pct_of_revised_cost`) account for over 37% of model decision weight, serving as robust early warning signals before outright stagnation appears.

3. **Decision-Support Limits: Why ML Alone Cannot Drive Public Governance Decisions**
   - Crucially, even the best ML model achieves an $R^2$ of **0.279** and an MAE of **15.46 months** on held-out projects. Over 70% of delay variance remains uncaptured by administrative reporting fields.
   - Public infrastructure delays are heavily driven by unrecorded real-world friction—environmental clearance delays, land litigation in district courts, utility shifting right-of-way disputes, contractor cash-flow insolvency, and extreme geological surprises.
   - For statutory governance and CAG audit scrutiny, a model with a ~15-month margin of error cannot serve as an autonomous arbiter of project intervention.
   - **Conclusion:** ML provides valuable empirical benchmarking and early warning indicators, but production decision-support requires PRISM's deterministic, rule-grounded Multi-Criteria Decision Analysis (MCDA) risk scoring engine.

---

## 3. SIH26103 Requirement (c): Common Upload Form (CUF) Attribution

The second half of the problem statement mandate requires:

> *"along with an assessment of the extent to which predictive performance is attributable to the current CUF fields vis-à-vis additional variables not presently captured in the CUF."*

### CUF Feature Mapping Table

Under MoSPI's Online Central Monitoring System (OCMS) / PAIMANA, executing agencies upload progress updates via the standardized **Common Upload Form (CUF)**:

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

### Empirical CUF Ablation Study (Model A vs. Model B)

Comparing Model A (CUF only) directly against Model B (CUF + Engineered Variables) under identical `GradientBoostingRegressor` hyperparameters and identical test splits:

| Metric | Model A: Native CUF Fields Only | Model B: CUF + Engineered Indicators | Incremental Improvement ($\Delta$) |
| :--- | :---: | :---: | :---: |
| **Mean Absolute Error (MAE)** | **16.52 months** | **15.46 months** | **-1.05 months (6.4% relative gain)** |
| **Root Mean Squared Error (RMSE)** | **25.46 months** | **24.89 months** | **-0.57 months (2.2% reduction)** |
| **Coefficient of Determination ($R^2$)** | **0.245** | **0.279** | **+0.033 variance explained (+13.5%)** |
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

Verified ablation metadata is saved in [`ml/artifacts/real_model_metadata.json`](artifacts/real_model_metadata.json).

---

## 4. Why PRISM Uses Deterministic Scoring in Production

In public infrastructure administration (MoSPI, PMG, Cabinet Secretariat), decisions concerning statutory project escalations cannot rely on black-box predictions. Public audit bodies (CAG) demand:
- **Traceability:** Exactly why a project scored 73 vs 52 (e.g., `[Progress Stagnation] 3 consecutive stagnant months`).
- **Repeatability:** Identical inputs must yield identical scores across reporting intervals.
- **Fairness:** Zero algorithmic bias across states, sectors, or contractors.

Therefore, PRISM uses the **deterministic 6-indicator PRISM Risk Engine** as the primary decision-support layer, supplemented by **Earned Schedule forecasting** and empirical regression benchmarks.
