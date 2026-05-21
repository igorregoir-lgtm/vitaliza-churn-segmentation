import pandas as pd
from .data_loader import FEATURES, FEATURE_LABELS, BINARY_FEATURES

# Colunas extra do CSV Vitaliza (não são features ML, mas entram na EDA de correlação)
EXTRA_EDA_COLS = ["gender", "Phone"]


def build_eda_report(df: pd.DataFrame) -> dict:
    df = df.copy()
    df["ratio_freq"] = (
        df["Avg_class_frequency_current_month"]
        / df["Avg_class_frequency_total"].replace(0, pd.NA)
    ).fillna(0)
    df["flag_early_user"] = (df["Lifetime"] <= 1).astype(int)

    summary = {
        "customers": int(len(df)),
        "churn_rate": round(float(df["Churn"].mean()), 4),
        "avg_age": round(float(df["Age"].mean()), 1),
        "avg_lifetime": round(float(df["Lifetime"].mean()), 1),
        "avg_frequency_month": round(float(df["Avg_class_frequency_current_month"].mean()), 2),
        "avg_extra_charges": round(float(df["Avg_additional_charges_total"].mean()), 2),
    }

    # Página 5 — Gráfico 1: churn por duração de contrato
    contract_churn = df.groupby("Contract_period")["Churn"].agg(["mean", "count"]).reset_index()
    churn_by_contract = [
        {
            "contract_period": int(row["Contract_period"]),
            "label": f"{int(row['Contract_period'])} mês" if int(row['Contract_period']) == 1
                     else f"{int(row['Contract_period'])} meses",
            "churn_rate": round(float(row["mean"]), 4),
            "count": int(row["count"]),
        }
        for _, row in contract_churn.iterrows()
    ]

    # Página 5 — Gráfico 2: janela crítica dos primeiros 30 dias
    cohort_bins = [-1, 1, 3, 6, 12, float("inf")]
    cohort_labels = ["0–1 mês", "2–3 meses", "4–6 meses", "7–12 meses", "13+ meses"]
    df["cohort"] = pd.cut(df["Lifetime"], bins=cohort_bins, labels=cohort_labels, include_lowest=True)
    cohort_group = df.groupby("cohort", observed=False)["Churn"].agg(["mean", "count"])
    churn_by_cohort = [
        {
            "label": str(label),
            "churn_rate": round(float(row["mean"]), 4) if pd.notna(row["mean"]) else 0,
            "count": int(row["count"]),
        }
        for label, row in cohort_group.iterrows()
    ]

    # Página 6 — fatores protetivos
    protective_features = [
        ("Group_visits", "Desafio em grupo"),
        ("Promo_friends", "Indicação de amigos"),
        ("Partner", "Convênio empresarial"),
    ]
    churn_by_protective = []
    for col, label in protective_features:
        without_churn = float(df[df[col] == 0]["Churn"].mean()) if (df[col] == 0).any() else 0
        with_churn = float(df[df[col] == 1]["Churn"].mean()) if (df[col] == 1).any() else 0
        churn_by_protective.append({
            "feature": col,
            "label": label,
            "without_churn_rate": round(without_churn, 4),
            "with_churn_rate": round(with_churn, 4),
            "reduction_pct": round((without_churn - with_churn) / max(without_churn, 0.001) * 100, 1),
            "count_without": int((df[col] == 0).sum()),
            "count_with": int((df[col] == 1).sum()),
        })

    # Página 7 — hierarquia de correlação (inclui gender e Phone se presentes)
    extra_present = [c for c in EXTRA_EDA_COLS if c in df.columns]
    derived_cols = ["ratio_freq", "flag_early_user"]
    all_corr_cols = FEATURES + extra_present + derived_cols + ["Churn"]
    available = [c for c in all_corr_cols if c in df.columns]
    correlations = (
        df[available]
        .corr(numeric_only=True)["Churn"]
        .drop("Churn")
        .sort_values(key=lambda v: v.abs(), ascending=False)
    )
    correlation_hierarchy = [
        {
            "feature": feat,
            "label": FEATURE_LABELS.get(feat, feat),
            "correlation": round(float(val), 4),
            "strength": round(float(abs(val)), 4),
        }
        for feat, val in correlations.items()
        if feat not in ("ratio_freq", "flag_early_user")  # hide derived from main chart
    ]

    # Comparação churn vs. retidos
    churn_means = df.groupby("Churn")[
        ["Age", "Lifetime", "Avg_class_frequency_current_month",
         "Avg_class_frequency_total", "Avg_additional_charges_total"]
    ].mean()
    comparison = [
        {
            "label": lbl,
            "stayed": round(float(churn_means.loc[0, feat]), 2) if 0 in churn_means.index else None,
            "churned": round(float(churn_means.loc[1, feat]), 2) if 1 in churn_means.index else None,
        }
        for feat, lbl in [
            ("Age", "Idade média"),
            ("Lifetime", "Tempo médio como cliente"),
            ("Avg_class_frequency_current_month", "Freq. média no mês"),
            ("Avg_class_frequency_total", "Freq. média histórica"),
            ("Avg_additional_charges_total", "Gastos extras médios"),
        ]
    ]

    scatter_sample = df.sample(n=min(len(df), 300), random_state=42)
    frequency_scatter = [
        {
            "x": round(float(row["Avg_class_frequency_total"]), 3),
            "y": round(float(row["Avg_class_frequency_current_month"]), 3),
            "churn": int(row["Churn"]),
        }
        for _, row in scatter_sample.iterrows()
    ]

    return {
        "summary": summary,
        "churn_by_contract": churn_by_contract,
        "churn_by_cohort": churn_by_cohort,
        "churn_by_protective": churn_by_protective,
        "correlation_hierarchy": correlation_hierarchy,
        "comparison_by_churn": comparison,
        "frequency_scatter": frequency_scatter,
    }
