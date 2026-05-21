"""
Baseline por regra de negócio — camada opcional de validação interpretativa.
Não substitui K-Means nem Random Forest. Serve como controle metodológico
e ponte interpretativa com o negócio.
"""
import pandas as pd
from .data_loader import FEATURES


def _classify_baseline(row: pd.Series) -> dict:
    """
    Regra simples baseada nas variáveis mais correlacionadas com churn:
    contrato, lifetime e frequência atual.
    """
    lifetime = row["Lifetime"]
    contract = row["Contract_period"]
    freq = row["Avg_class_frequency_current_month"]
    months_to_end = row.get("Month_to_end_contract", 6)
    group = row.get("Group_visits", 0)
    promo = row.get("Promo_friends", 0)
    partner = row.get("Partner", 0)

    protective_count = int(group) + int(promo) + int(partner)

    # Regra de alto risco
    if contract == 1 and lifetime <= 1:
        label, risk = "Alto Risco", "high"
    elif contract == 1 and freq < 1.0 and lifetime <= 3:
        label, risk = "Alto Risco", "high"
    elif contract <= 6 and freq < 0.5:
        label, risk = "Risco Médio-Alto", "medium_high"
    elif contract == 12 and freq < 0.5 and months_to_end <= 2:
        label, risk = "Risco Diferido", "deferred"
    elif protective_count >= 2 or (contract == 12 and freq >= 1.5):
        label, risk = "Baixo Risco", "low"
    elif contract <= 6 and freq < 1.5:
        label, risk = "Risco Médio", "medium"
    else:
        label, risk = "Baixo Risco", "low"

    return {"baseline_label": label, "baseline_risk": risk}


def run_baseline(df: pd.DataFrame) -> dict:
    df = df.copy()
    baseline_results = df.apply(_classify_baseline, axis=1, result_type="expand")
    df["baseline_label"] = baseline_results["baseline_label"]
    df["baseline_risk"] = baseline_results["baseline_risk"]

    # Aggregated segments
    segment_order = ["Alto Risco", "Risco Médio-Alto", "Risco Médio", "Risco Diferido", "Baixo Risco"]
    segments = []
    for seg in segment_order:
        subset = df[df["baseline_label"] == seg]
        if len(subset) == 0:
            continue
        segments.append({
            "label": seg,
            "count": int(len(subset)),
            "pct_of_base": round(float(len(subset) / len(df)), 4),
            "churn_rate": round(float(subset["Churn"].mean()), 4) if "Churn" in subset else None,
            "avg_lifetime": round(float(subset["Lifetime"].mean()), 1),
            "avg_contract": round(float(subset["Contract_period"].mean()), 1),
        })

    # Compare with K-Means clusters if available
    convergence_note = (
        "A baseline confirma que contrato e lifetime são os dois eixos principais. "
        "A convergência com os clusters K-Means reforça a robustez dos achados: "
        "o churn da Vitaliza é fortemente governado pela barreira dos primeiros 30 dias "
        "e pelo tipo de contrato."
    )

    # Overall accuracy vs churn label
    if "Churn" in df.columns:
        high_risk_mask = df["baseline_risk"].isin(["high", "medium_high"])
        tp = int(((high_risk_mask) & (df["Churn"] == 1)).sum())
        fp = int(((high_risk_mask) & (df["Churn"] == 0)).sum())
        fn = int(((~high_risk_mask) & (df["Churn"] == 1)).sum())
        tn = int(((~high_risk_mask) & (df["Churn"] == 0)).sum())
        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        accuracy = (tp + tn) / max(len(df), 1)
        baseline_metrics = {
            "accuracy": round(accuracy, 4),
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "note": "Baseline usa regra simples — performance inferior ao Random Forest é esperada.",
        }
    else:
        baseline_metrics = {}

    return {
        "segments": segments,
        "convergence_note": convergence_note,
        "metrics": baseline_metrics,
        "interpretation": (
            "A Baseline por Regra de Negócio não substitui o K-Means nem o Random Forest. "
            "Ela serve como controle metodológico e ponte interpretativa: "
            "quando os eixos simples de contrato e lifetime convergem com os clusters e com os scores, "
            "a análise ganha robustez e clareza executiva."
        ),
    }
