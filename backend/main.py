from datetime import datetime, timezone
import joblib
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path

from services.data_loader import (
    read_uploaded_csv, clean_dataset,
    FEATURES, FEATURE_LABELS, DEFAULT_FEATURE_VALUES,
)
from services.eda import build_eda_report
from services.kmeans_segmentation import run_kmeans
from services.random_forest_churn import train_random_forest, get_score_by_cluster, score_single_customer
from services.business_rules_baseline import run_baseline

BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "model.pkl"

app = FastAPI(title="Vitaliza — Customer Segmentation API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state
model = None
feature_defaults = DEFAULT_FEATURE_VALUES.copy()
model_feature_importances: dict = {}
last_training_info: dict | None = None

try:
    if MODEL_PATH.exists():
        model = joblib.load(MODEL_PATH)
        if hasattr(model, "feature_importances_"):
            model_feature_importances = {
                f: float(i) for f, i in zip(FEATURES, model.feature_importances_)
            }
except Exception:
    model = None


class CustomerData(BaseModel):
    Lifetime: int | None = None
    Avg_class_frequency_current_month: float | None = None
    Age: int | None = None
    Contract_period: int | None = None
    Month_to_end_contract: float | None = None
    Avg_class_frequency_total: float | None = None
    Avg_additional_charges_total: float | None = None
    Group_visits: int | None = None
    Promo_friends: int | None = None
    Partner: int | None = None
    Near_Location: int | None = None


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "product": "Vitaliza — A Arquitetura da Retenção Preditiva",
        "model_loaded": model is not None,
        "trained_at": last_training_info["trained_at"] if last_training_info else None,
        "metrics": last_training_info["metrics"] if last_training_info else None,
    }


@app.post("/eda")
async def analyze_csv(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 2:
        raise HTTPException(status_code=400, detail="CSV com poucos registros válidos após limpeza.")
    report = build_eda_report(df)
    return {"status": "analyzed", "filename": file.filename, "cleaning": cleaning, **report}


@app.post("/train")
async def train_model(file: UploadFile = File(...)):
    global model, feature_defaults, model_feature_importances, last_training_info

    raw = await read_uploaded_csv(file)
    df, _ = clean_dataset(raw)
    if len(df) < 10:
        raise HTTPException(status_code=400, detail="CSV com poucos registros válidos para treino.")

    result = train_random_forest(df)
    model = result["model"]
    feature_defaults = result["defaults"]
    model_feature_importances = {
        item["feature"]: item["importance"] for item in result["feature_importances"]
    }
    last_training_info = {
        "trained_at": result["trained_at"],
        "filename": file.filename,
        "metrics": result["metrics"],
    }
    joblib.dump(model, MODEL_PATH)

    return {
        "status": "trained",
        "model_loaded": True,
        "trained_at": result["trained_at"],
        "filename": file.filename,
        "metrics": result["metrics"],
        "feature_importances": result["feature_importances"],
        "score_distribution": result["score_distribution"],
        "roc_curve": result["roc_curve"],
    }


@app.post("/segment")
async def segment_customers(
    file: UploadFile = File(...),
    k: int = Form(default=4),
):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < max(k * 3, 10):
        raise HTTPException(status_code=400, detail="CSV com poucos registros para segmentação.")

    k = max(2, min(k, 10))
    result = run_kmeans(df, k=k)
    return {"status": "segmented", "filename": file.filename, "cleaning": cleaning, **result}


@app.post("/segment-and-score")
async def segment_and_score(
    file: UploadFile = File(...),
    k: int = Form(default=4),
):
    """Full pipeline: K-Means segmentation + RF scoring per cluster."""
    global model, feature_defaults, model_feature_importances, last_training_info

    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 20:
        raise HTTPException(status_code=400, detail="CSV com poucos registros para análise completa.")

    k = max(2, min(k, 10))

    seg_result = run_kmeans(df, k=k)
    rf_result = train_random_forest(df)

    model = rf_result["model"]
    feature_defaults = rf_result["defaults"]
    model_feature_importances = {
        item["feature"]: item["importance"] for item in rf_result["feature_importances"]
    }
    last_training_info = {
        "trained_at": rf_result["trained_at"],
        "filename": file.filename,
        "metrics": rf_result["metrics"],
    }
    joblib.dump(model, MODEL_PATH)

    # Merge cluster assignments (full labels) with RF scores
    df_merged = rf_result["df_with_scores"].copy()
    all_labels = seg_result.get("all_cluster_labels", [])
    if len(all_labels) == len(df_merged):
        df_merged["cluster"] = all_labels
    score_by_cluster = get_score_by_cluster(df_merged)

    baseline_result = run_baseline(df)
    eda_report = build_eda_report(df)

    return {
        "status": "complete",
        "filename": file.filename,
        "cleaning": cleaning,
        "eda": eda_report,
        "segmentation": {k_: v for k_, v in seg_result.items() if k_ not in ("customers", "all_cluster_labels")},
        "prediction": {
            "metrics": rf_result["metrics"],
            "feature_importances": rf_result["feature_importances"],
            "score_distribution": rf_result["score_distribution"],
            "roc_curve": rf_result["roc_curve"],
            "score_by_cluster": score_by_cluster,
        },
        "baseline": baseline_result,
    }


@app.post("/baseline")
async def baseline_analysis(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 2:
        raise HTTPException(status_code=400, detail="CSV com poucos registros para análise.")
    result = run_baseline(df)
    return {"status": "baseline_computed", "filename": file.filename, "cleaning": cleaning, **result}


@app.post("/predict")
def predict(data: CustomerData):
    if model is None:
        raise HTTPException(
            status_code=503,
            detail="Modelo não treinado. Faça upload do CSV na aba de análise.",
        )
    input_data = data.model_dump()
    informed = sum(v is not None for v in input_data.values())
    if informed < 2:
        raise HTTPException(status_code=400, detail="Informe pelo menos 2 campos.")

    result = score_single_customer(model, feature_defaults, input_data)

    # Top 3 drivers
    drivers = []
    for feat in FEATURES:
        val = input_data[feat] if input_data[feat] is not None else feature_defaults.get(feat, 0)
        ref = feature_defaults.get(feat, DEFAULT_FEATURE_VALUES.get(feat, 0))
        imp = model_feature_importances.get(feat, 0)
        delta = abs(float(val) - float(ref)) / max(abs(float(ref)), 1)
        score = imp * max(delta, 0.2)
        direction = "acima da referência" if val > ref else "abaixo da referência" if val < ref else "na referência"
        drivers.append({
            "feature": feat,
            "label": FEATURE_LABELS.get(feat, feat),
            "value": round(float(val), 4),
            "reference_value": round(float(ref), 4),
            "importance": round(imp, 4),
            "driver_score": round(score, 4),
            "direction": direction,
        })
    top3 = sorted(drivers, key=lambda d: (d["driver_score"], d["importance"]), reverse=True)[:3]
    result["top_3_drivers"] = top3
    return result
