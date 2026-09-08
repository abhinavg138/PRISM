# PRISM Machine Learning & Predictive Analytics Architecture

## 1. Dual Intelligence Paradigm

PRISM operates on an intellectually rigorous, auditable architecture designed for national public governance:

```text
+-----------------------------------------------------------------------------------------+
|                                    PRISM INTELLIGENCE                                   |
+-----------------------------------------------------------------------------------------+
| [Layer 1] Current Health & Prioritization:                                             |
|   -> 100% Deterministic PRISM Risk Engine (6 Indicators, 0-100 MCDA Score)              |
|   -> Priority Intervention Engine (P1/P2/P3 Action Queue)                               |
|   -> Early Warning Radar (1,036 Anomaly Alerts)                                         |
|                                                                                         |
| [Layer 2] Forward-Looking Project Forecast:                                             |
|   -> Earned Schedule & EAC Forecasting (ISO 21508 EVM)                                  |
|   -> Extrapolates monthly progress velocity and expenditure divergence                  |
|                                                                                         |
| [Layer 3] Empirical Machine Learning Benchmark:                                         |
|   -> ml/train_real_models.py                                                            |
|   -> Trained on 7,499 longitudinal MoSPI PAIMANA observations across 2,054 projects     |
|   -> Group-stratified train/test validation eliminating observation leakage             |
+-----------------------------------------------------------------------------------------+
```

---

## 2. Empirical Model Evaluation (Grounded on Real PAIMANA Data)

The empirical gradient boosting pipeline (`ml/train_real_models.py`) evaluates real infrastructure delay predictors across all 2,054 monitored Central Sector assets:

| Parameter | Value |
| :--- | :--- |
| **Training Dataset** | MoSPI PAIMANA April–July 2026 Reporting Cycle (`data/PRISM_ML_features_v1.csv`) |
| **Total Observations** | 7,499 snapshot records |
| **Unique Monitored Projects** | 2,054 Central Sector assets |
| **Validation Strategy** | `GroupShuffleSplit` (80% train / 20% test grouped by `project_id`) |
| **Test Set Size** | 1,497 held-out project observations |
| **Mean Absolute Error (MAE)** | 16.21 months on unseen projects |
| **Root Mean Squared Error (RMSE)** | 25.57 months |
| **Top Delay Predictors (Gini Importance)** | Physical Progress (37.0%), Original Cost (15.8%), Revised Cost (15.4%), Expenditure % (11.2%) |

Verified metadata is saved in `ml/artifacts/real_model_metadata.json`.

---

## 3. Why PRISM Uses Deterministic Scoring in Production

In public infrastructure administration (MoSPI, PMG, Cabinet Secretariat), decisions concerning statutory project escalations cannot rely on black-box predictions. Public audit bodies (CAG) demand:
- **Traceability:** Exactly why a project scored 73 vs 52 (e.g., `[Progress Stagnation] 3 consecutive stagnant months`).
- **Repeatability:** Identical inputs must yield identical scores across reporting intervals.
- **Fairness:** Zero algorithmic bias across states, sectors, or contractors.

Therefore, PRISM uses the **deterministic 6-indicator PRISM Risk Engine** as the primary decision-support layer, supplemented by **Earned Schedule forecasting** and empirical regression benchmarks.
