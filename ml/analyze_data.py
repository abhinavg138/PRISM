import pandas as pd
import numpy as np

FILE = "../data/PRISM_PAIMANA_Dataset_v1_Apr-Jul_2026.xlsx"

# Load dataset
df = pd.read_excel(
    FILE,
    sheet_name="project_snapshots"
)

print("=" * 60)
print("PRISM DATASET ANALYSIS")
print("=" * 60)

# --------------------------------------------------
# 1. Basic information
# --------------------------------------------------

print("\nDATASET SIZE")
print("Rows:", len(df))
print("Columns:", len(df.columns))

print("\nUNIQUE PROJECTS")
print(df["project_id"].nunique())

print("\nREPORT MONTHS")
print(df["report_month"].value_counts().sort_index())

# --------------------------------------------------
# 2. Missing values
# --------------------------------------------------

print("\nMISSING VALUES")
missing = df.isna().sum()
missing_pct = (missing / len(df) * 100).round(2)

missing_report = pd.DataFrame({
    "missing": missing,
    "missing_pct": missing_pct
})

print(
    missing_report[
        missing_report["missing"] > 0
    ].sort_values("missing_pct", ascending=False)
)

# --------------------------------------------------
# 3. Duplicate project/month observations
# --------------------------------------------------

duplicates = df.duplicated(
    subset=["project_id", "report_month"]
).sum()

print("\nDUPLICATE PROJECT/MONTH ROWS:", duplicates)

# --------------------------------------------------
# 4. Projects appearing in each number of months
# --------------------------------------------------

months_per_project = (
    df.groupby("project_id")["report_month"]
    .nunique()
)

print("\nPROJECT OBSERVATION COUNTS")
print(months_per_project.value_counts().sort_index())

print(
    "\nProjects appearing in all 4 months:",
    (months_per_project == 4).sum()
)

# --------------------------------------------------
# 5. Delhi projects
# --------------------------------------------------

delhi = df[
    df["state"]
    .astype(str)
    .str.contains("Delhi", case=False, na=False)
]

print("\nDELHI OBSERVATIONS:", len(delhi))
print("DELHI PROJECTS:", delhi["project_id"].nunique())

# --------------------------------------------------
# 6. Physical progress sanity checks
# --------------------------------------------------

bad_progress = df[
    (df["physical_progress_pct"] < 0) |
    (df["physical_progress_pct"] > 100)
]

print(
    "\nINVALID PHYSICAL PROGRESS:",
    len(bad_progress)
)

# --------------------------------------------------
# 7. Cost sanity checks
# --------------------------------------------------

bad_cost = df[
    (df["original_cost_cr"] < 0) |
    (df["revised_cost_cr"] < 0) |
    (df["cumulative_expenditure_cr"] < 0)
]

print("INVALID COST VALUES:", len(bad_cost))

# Expenditure greater than revised cost
high_expenditure = df[
    df["cumulative_expenditure_cr"]
    > df["revised_cost_cr"]
]

print(
    "EXPENDITURE > REVISED COST:",
    len(high_expenditure)
)

# --------------------------------------------------
# 8. Cost revisions
# --------------------------------------------------

cost_revision = df[
    df["revised_cost_cr"]
    > df["original_cost_cr"]
]

print(
    "\nPROJECT OBSERVATIONS WITH COST REVISION:",
    len(cost_revision)
)

# --------------------------------------------------
# 9. Progress changes
# --------------------------------------------------

df = df.sort_values(
    ["project_id", "report_month"]
)

df["progress_change"] = (
    df.groupby("project_id")["physical_progress_pct"]
    .diff()
)

df["expenditure_change"] = (
    df.groupby("project_id")["cumulative_expenditure_cr"]
    .diff()
)

print("\nPROGRESS CHANGE STATISTICS")

print(
    df["progress_change"].describe()
)

# --------------------------------------------------
# 10. Derived risk features
# --------------------------------------------------

# Spending as % of revised project cost
df["expenditure_pct"] = (
    df["cumulative_expenditure_cr"]
    / df["revised_cost_cr"]
    * 100
)

# Difference between physical progress and expenditure
df["progress_expenditure_gap"] = (
    df["physical_progress_pct"]
    - df["expenditure_pct"]
)

# Cost revision
df["cost_revision_pct"] = (
    (
        df["revised_cost_cr"]
        - df["original_cost_cr"]
    )
    / df["original_cost_cr"]
    * 100
)

# --------------------------------------------------
# 11. Save processed dataset
# --------------------------------------------------

output = "../data/PRISM_ML_features_v1.csv"

df.to_csv(
    output,
    index=False
)

print("\nPROCESSED DATASET SAVED:")
print(output)

print("\nDONE.")