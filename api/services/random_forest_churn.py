import pandas as pd
from datetime import datetime, timezone
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    roc_auc_score, confusion_matrix, f1_score, roc_curve,
)
from .data_loader import FEATURES, FEATURE_LABELS


def train_random_forest(df: pd.DataFrame) -> dict:
    X = df[FEATURES]
    y = df["Churn"]

    if y.nunique() < 2 or y.value_counts().min() < 2:
        raise ValueError("A coluna Churn precisa ter exemplos das classes 0 e 1.")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    clf = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)
    y_proba = clf.predict_proba(X_test)[:, 1]

    metrics = {
        "rows_used": int(len(df)),
        "test_rows": int(len(X_test)),
        "churn_rate": round(float(y.mean()), 4),
        "roc_auc": round(float(roc_auc_score(y_test, y_proba)), 4),
        "accuracy": round(float(accuracy_score(y_test, y_pred)), 4),
        "precision": round(float(precision_score(y_test, y_pred, zero_division=0)), 4),
        "recall": round(float(recall_score(y_test, y_pred, zero_division=0)), 4),
        "f1": round(float(f1_score(y_test, y_pred, zero_division=0)), 4),
        "confusion_matrix": confusion_matrix(y_test, y_pred).tolist(),
    }

    feature_importances = [
        {"feature": feat, "label": FEATURE_LABELS.get(feat, feat), "importance": round(float(imp), 4)}
        for feat, imp in sorted(
            zip(FEATURES, clf.feature_importances_), key=lambda x: x[1], reverse=True
        )
    ]

    all_proba = clf.predict_proba(X)[:, 1]
    df = df.copy()
    df["churn_score"] = all_proba
    df["churn_pred"] = clf.predict(X)

    bins = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    bucket_labels = ["0–10%", "10–20%", "20–30%", "30–40%", "40–50%",
                     "50–60%", "60–70%", "70–80%", "80–90%", "90–100%"]
    cut = pd.cut(df["churn_score"], bins=bins, labels=bucket_labels, include_lowest=True)
    counts = cut.value_counts().sort_index()
    total = max(len(df), 1)
    score_distribution = [
        {"bucket": str(lbl), "count": int(counts.get(lbl, 0)), "pct": round(float(counts.get(lbl, 0) / total), 4)}
        for lbl in bucket_labels
    ]

    fpr, tpr, _ = roc_curve(y_test, y_proba)
    step = max(1, len(fpr) // 50)
    roc_points = [{"fpr": round(float(f), 4), "tpr": round(float(t), 4)} for f, t in zip(fpr[::step], tpr[::step])]

    defaults = {feat: float(X[feat].median()) for feat in FEATURES}
    for bf in ["Group_visits", "Promo_friends", "Partner", "Near_Location"]:
        defaults[bf] = int(X[bf].mode().iloc[0])

    return {
        "model": clf,
        "metrics": metrics,
        "feature_importances": feature_importances,
        "score_distribution": score_distribution,
        "roc_curve": roc_points,
        "defaults": defaults,
        "df_with_scores": df,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }


def get_score_by_cluster(df_scores: pd.DataFrame) -> list[dict]:
    if "cluster" not in df_scores.columns or "churn_score" not in df_scores.columns:
        return []
    return [
        {
            "cluster_id": int(cid),
            "avg_score": round(float(grp["churn_score"].mean()), 4),
            "high_risk_pct": round(float((grp["churn_score"] >= 0.5).mean()), 4),
            "count": int(len(grp)),
        }
        for cid, grp in df_scores.groupby("cluster")
    ]


def score_single_customer(model, feature_defaults: dict, data: dict) -> dict:
    from .data_loader import DEFAULT_FEATURE_VALUES
    feature_values = [
        data.get(f) if data.get(f) is not None else feature_defaults.get(f, DEFAULT_FEATURE_VALUES.get(f, 0))
        for f in FEATURES
    ]
    features = pd.DataFrame([feature_values], columns=FEATURES)
    prob = float(model.predict_proba(features)[0][1])
    if prob >= 0.7:
        label, level = "Alto Risco de Churn", "high"
    elif prob >= 0.4:
        label, level = "Risco Médio de Churn", "medium"
    else:
        label, level = "Baixo Risco de Churn", "low"
    return {"churn_probability": round(prob, 4), "churn_label": label, "risk_level": level}
