import pandas as pd
import numpy as np
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from .data_loader import FEATURES, FEATURE_LABELS

# Personas fixas para K=4 (mapeadas por perfil de churn + contrato)
PERSONA_MAP = {
    # chave: tupla ordenada (churn_rank 0=menor,3=maior, contract_rank 0=menor,3=maior)
    # Será atribuída depois de ordenar os clusters por churn_rate
}

PERSONA_NAMES = [
    "C0 · Recém-chegado em fuga",
    "C1 · Leal anual",
    "C2 · Engajado mensal",
    "C3 · Médio em trânsito",
]

PERSONA_SETUP = [
    "Novo usuário, contrato mensal, pouco tempo de plataforma.",
    "Cliente antigo, contrato anual, alta frequência histórica.",
    "Cliente de média maturidade, contrato mensal, engajamento ativo.",
    "Cliente de médio prazo, contrato misto, sinais de queda de engajamento.",
]

PERSONA_CONFLICT = [
    "Alta taxa de churn nos primeiros 30 dias — não criou hábito.",
    "Baixa taxa de churn, mas risco de sleeping dog se frequência cair.",
    "Risco de churn por expiração de contrato mensal sem renovação automática.",
    "Sinais mistos — frequência histórica razoável, mas frequência atual em queda.",
]

PERSONA_RESOLUTION = [
    "Onboarding intensivo nos primeiros 30 dias é a alavanca principal.",
    "Preservação e advocacy — evitar sleeping dogs. Não supercontatar.",
    "Migração assistida para contrato anual ou renovação com benefício.",
    "Principal caso de uso do modelo preditivo — priorizar ação cirúrgica.",
]

PERSONA_DECISION = [
    "Gatilho: 7 dias sem acesso. Ação: régua de ativação. Hipótese: hábito salva.",
    "Gatilho: frequência < 0,5/sem. Ação: contato suave. Hipótese: evitar perda silenciosa.",
    "Gatilho: vencimento do contrato. Ação: oferta de migração. Hipótese: preço + compromisso.",
    "Gatilho: score RF alto. Ação: contato proativo personalizado. Hipótese: intervenção precoce.",
]

PERSONA_LIMIT = [
    "Não temos motivo declarado de cancelamento. Hipótese de hábito ainda a validar.",
    "Correlação entre frequência e retenção não implica causalidade direta.",
    "Não sabemos se o preço é o real driver vs. preferência por flexibilidade.",
    "O C3 é heterogêneo — pode conter perfis muito distintos internamente.",
]

CLUSTER_ACTIONS = [
    "Ação imediata — onboarding nos primeiros 30 dias.",
    "Preservação / advocacy — evitar sleeping dogs.",
    "Migração assistida — oportunidade contratual.",
    "Priorização preditiva — principal caso de uso do Random Forest.",
]

HEATMAP_FEATURES = [
    "Lifetime",
    "Avg_class_frequency_current_month",
    "Age",
    "Contract_period",
    "Month_to_end_contract",
    "Group_visits",
    "Promo_friends",
    "Partner",
]


def _assign_personas(cluster_profiles: list[dict]) -> list[dict]:
    """
    Sort clusters by churn_rate descending and assign personas:
    highest churn → C0 (fuga), lowest churn → C1 (leal),
    mid with monthly → C2, remaining → C3.
    """
    sorted_by_churn = sorted(cluster_profiles, key=lambda c: c["churn_rate"], reverse=True)
    result = []
    for rank, cluster in enumerate(sorted_by_churn):
        persona_idx = rank if rank < 4 else 3
        result.append({**cluster, "persona_index": persona_idx})
    return result


def run_kmeans(df: pd.DataFrame, k: int = 4) -> dict:
    X = df[FEATURES].copy()
    y = df["Churn"].values

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    km = KMeans(n_clusters=k, random_state=42, n_init=30)
    labels = km.fit_predict(X_scaled)
    inertia = float(km.inertia_)
    sil_score = float(silhouette_score(X_scaled, labels)) if k > 1 else 0.0

    df = df.copy()
    df["cluster"] = labels

    cluster_profiles = []
    for cluster_id in range(k):
        mask = df["cluster"] == cluster_id
        subset = df[mask]
        profile = {
            "cluster_id": cluster_id,
            "size": int(mask.sum()),
            "churn_rate": round(float(subset["Churn"].mean()), 4),
            "avg_lifetime": round(float(subset["Lifetime"].mean()), 2),
            "avg_frequency": round(float(subset["Avg_class_frequency_current_month"].mean()), 2),
            "avg_age": round(float(subset["Age"].mean()), 1),
            "avg_contract": round(float(subset["Contract_period"].mean()), 1),
            "avg_months_to_end": round(float(subset["Month_to_end_contract"].mean()), 1),
            "pct_group_visits": round(float(subset["Group_visits"].mean()), 4),
            "pct_promo_friends": round(float(subset["Promo_friends"].mean()), 4),
            "pct_partner": round(float(subset["Partner"].mean()), 4),
        }
        cluster_profiles.append(profile)

    # Assign personas based on churn rank
    sorted_profiles = sorted(cluster_profiles, key=lambda c: c["churn_rate"], reverse=True)
    persona_lookup = {}
    for rank, p in enumerate(sorted_profiles):
        idx = min(rank, 3)
        persona_lookup[p["cluster_id"]] = idx

    for profile in cluster_profiles:
        idx = persona_lookup[profile["cluster_id"]]
        profile["persona_index"] = idx
        profile["persona_name"] = PERSONA_NAMES[idx]
        profile["setup"] = PERSONA_SETUP[idx]
        profile["conflict"] = PERSONA_CONFLICT[idx]
        profile["resolution"] = PERSONA_RESOLUTION[idx]
        profile["decision"] = PERSONA_DECISION[idx]
        profile["limit"] = PERSONA_LIMIT[idx]
        profile["action"] = CLUSTER_ACTIONS[idx]

    # Heatmap data — normalized mean values per cluster per feature
    heatmap_features = [f for f in HEATMAP_FEATURES if f in df.columns]
    feature_means = df.groupby("cluster")[heatmap_features].mean()
    global_min = feature_means.min()
    global_max = feature_means.max()

    heatmap_rows = []
    for feat in heatmap_features:
        range_val = max(float(global_max[feat] - global_min[feat]), 0.001)
        row = {
            "feature": feat,
            "label": FEATURE_LABELS.get(feat, feat),
            "values": [],
        }
        for cluster_id in range(k):
            mask = df["cluster"] == cluster_id
            raw_val = float(df[mask][feat].mean())
            normalized = (raw_val - float(global_min[feat])) / range_val
            row["values"].append({
                "cluster_id": cluster_id,
                "raw": round(raw_val, 3),
                "normalized": round(normalized, 4),
                "persona_name": PERSONA_NAMES[persona_lookup.get(cluster_id, 0)],
            })
        heatmap_rows.append(row)

    # Full cluster labels array (all rows, for merging with RF scores)
    all_cluster_labels = [int(c) for c in df["cluster"].values]

    # Customer list sample for UI display (capped for response size)
    customer_list = [
        {
            "index": int(idx),
            "cluster_id": int(row["cluster"]),
            "persona_name": PERSONA_NAMES[persona_lookup.get(int(row["cluster"]), 0)],
            "churn": int(row["Churn"]),
        }
        for idx, row in df[["cluster", "Churn"]].iterrows()
    ][:500]

    return {
        "k": k,
        "inertia": round(inertia, 2),
        "silhouette_score": round(sil_score, 4),
        "cluster_profiles": cluster_profiles,
        "heatmap": heatmap_rows,
        "customers": customer_list,
        "all_cluster_labels": all_cluster_labels,
        "persona_names": PERSONA_NAMES[:k],
    }
