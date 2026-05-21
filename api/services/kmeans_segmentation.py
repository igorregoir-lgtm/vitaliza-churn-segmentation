import pandas as pd
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
from .data_loader import FEATURES, FEATURE_LABELS

PERSONA_NAMES = [
    "C0 · O Recém-chegado em fuga",
    "C1 · O Leal anual",
    "C2 · O Engajado mensal",
    "C3 · O Médio em trânsito",
]

# Mapeamento por rank de churn (decrescente): rank → persona_index
# C0=56%, C3=27%, C2=9%, C1=3% → [0,3,2,1]
PERSONA_BY_CHURN_RANK = [0, 3, 2, 1]

HEATMAP_FEATURES = [
    "Lifetime", "Avg_class_frequency_current_month", "Age",
    "Contract_period", "Month_to_end_contract",
    "Group_visits", "Promo_friends", "Partner",
]


def run_kmeans(df: pd.DataFrame, k: int = 4) -> dict:
    X = df[FEATURES].copy()

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

    # Atribuição de personas por rank de churn decrescente
    sorted_by_churn = sorted(cluster_profiles, key=lambda c: c["churn_rate"], reverse=True)
    persona_lookup: dict[int, int] = {}
    for rank, p in enumerate(sorted_by_churn):
        persona_idx = PERSONA_BY_CHURN_RANK[rank] if rank < len(PERSONA_BY_CHURN_RANK) else rank % 4
        persona_lookup[p["cluster_id"]] = persona_idx

    for profile in cluster_profiles:
        idx = persona_lookup[profile["cluster_id"]]
        profile["persona_index"] = idx
        profile["persona_name"] = PERSONA_NAMES[idx]

    # Heatmap normalizado por feature
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
                "persona_index": persona_lookup.get(cluster_id, 0),
            })
        heatmap_rows.append(row)

    all_cluster_labels = [int(c) for c in df["cluster"].values]

    customer_list = [
        {
            "index": int(idx),
            "cluster_id": int(row["cluster"]),
            "persona_index": persona_lookup.get(int(row["cluster"]), 0),
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
