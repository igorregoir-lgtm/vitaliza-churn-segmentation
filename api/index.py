import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import joblib
from pathlib import Path
from pydantic import BaseModel
import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.data_loader import (
    read_uploaded_csv, clean_dataset,
    FEATURES, FEATURE_LABELS, DEFAULT_FEATURE_VALUES,
)
from services.eda import build_eda_report
from services.kmeans_segmentation import run_kmeans
from services.random_forest_churn import train_random_forest, get_score_by_cluster, score_single_customer
from services.business_rules_baseline import run_baseline

app = FastAPI(title="Vitaliza API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory model state (persists within a warm serverless instance) ─────────
MODEL_PATH = Path("/tmp/vitaliza_model.pkl")
_model = None
_feature_defaults: dict = {}
_importances: dict = {}


class CustomerData(BaseModel):
    Lifetime: float | None = None
    Avg_class_frequency_current_month: float | None = None
    Age: float | None = None
    Contract_period: float | None = None
    Month_to_end_contract: float | None = None
    Avg_class_frequency_total: float | None = None
    Avg_additional_charges_total: float | None = None
    Group_visits: int | None = None
    Promo_friends: int | None = None
    Partner: int | None = None
    Near_Location: int | None = None


def _save_model(rf_result: dict) -> None:
    global _model, _feature_defaults, _importances
    _model = rf_result["model"]
    _feature_defaults = rf_result["defaults"]
    _importances = {item["feature"]: item["importance"] for item in rf_result["feature_importances"]}
    try:
        joblib.dump({"model": _model, "defaults": _feature_defaults, "importances": _importances}, MODEL_PATH)
    except Exception:
        pass


def _load_model() -> bool:
    global _model, _feature_defaults, _importances
    if _model is not None:
        return True
    try:
        if MODEL_PATH.exists():
            state = joblib.load(MODEL_PATH)
            _model = state["model"]
            _feature_defaults = state.get("defaults", {})
            _importances = state.get("importances", {})
            return True
    except Exception:
        pass
    return False


# ── Routes ─────────────────────────────────────────────────────────────────────

@app.get("/api")
def health():
    return {"status": "ok", "product": "Vitaliza — A Arquitetura da Retenção Preditiva", "model_loaded": _model is not None}


@app.post("/api/eda")
async def analyze_csv(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 2:
        raise HTTPException(status_code=400, detail="CSV com poucos registros válidos.")
    report = build_eda_report(df)
    return {"status": "analyzed", "filename": file.filename, "cleaning": cleaning, **report}


@app.post("/api/train")
async def train_model(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 10:
        raise HTTPException(status_code=400, detail="CSV com poucos registros para treino.")
    rf_result = train_random_forest(df)
    _save_model(rf_result)
    return {
        "status": "trained",
        "filename": file.filename,
        "cleaning": cleaning,
        "metrics": rf_result["metrics"],
        "feature_importances": rf_result["feature_importances"],
        "score_distribution": rf_result["score_distribution"],
        "roc_curve": rf_result["roc_curve"],
    }


@app.post("/api/predict")
async def predict(data: CustomerData):
    if not _load_model():
        raise HTTPException(
            status_code=503,
            detail="Modelo não treinado. Faça upload do CSV e execute a análise primeiro.",
        )
    input_data = data.model_dump()
    informed = sum(v is not None for v in input_data.values())
    if informed < 2:
        raise HTTPException(status_code=400, detail="Informe pelo menos 2 campos.")
    result = score_single_customer(_model, _feature_defaults, input_data)
    drivers = []
    for feat in FEATURES:
        val = input_data[feat] if input_data[feat] is not None else _feature_defaults.get(feat, DEFAULT_FEATURE_VALUES.get(feat, 0))
        ref = _feature_defaults.get(feat, DEFAULT_FEATURE_VALUES.get(feat, 0))
        imp = _importances.get(feat, 0)
        delta = abs(float(val) - float(ref)) / max(abs(float(ref)), 1)
        driver_score = imp * max(delta, 0.2)
        direction = "acima da referência" if val > ref else "abaixo da referência" if val < ref else "na referência"
        drivers.append({
            "feature": feat, "label": FEATURE_LABELS.get(feat, feat),
            "value": round(float(val), 4), "reference_value": round(float(ref), 4),
            "importance": round(imp, 4), "driver_score": round(driver_score, 4), "direction": direction,
        })
    result["top_3_drivers"] = sorted(drivers, key=lambda d: (d["driver_score"], d["importance"]), reverse=True)[:3]
    return result


@app.post("/api/segment")
async def segment_customers(file: UploadFile = File(...), k: int = Form(default=4)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < max(k * 3, 10):
        raise HTTPException(status_code=400, detail="CSV com poucos registros para segmentação.")
    k = max(2, min(k, 10))
    result = run_kmeans(df, k=k)
    result.pop("all_cluster_labels", None)
    return {"status": "segmented", "filename": file.filename, "cleaning": cleaning, **result}


@app.post("/api/segment-and-score")
async def segment_and_score(file: UploadFile = File(...), k: int = Form(default=4)):
    """Pipeline completo: EDA + K-Means + Random Forest + Baseline."""
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 20:
        raise HTTPException(status_code=400, detail="CSV com poucos registros para análise completa.")
    k = max(2, min(k, 10))

    seg_result = run_kmeans(df, k=k)
    rf_result = train_random_forest(df)
    _save_model(rf_result)

    df_merged = rf_result["df_with_scores"].copy()
    all_labels = seg_result.get("all_cluster_labels", [])
    if len(all_labels) == len(df_merged):
        df_merged["cluster"] = all_labels
    score_by_cluster = get_score_by_cluster(df_merged)

    baseline_result = run_baseline(df)
    eda_report = build_eda_report(df)

    seg_payload = {k_: v for k_, v in seg_result.items() if k_ not in ("customers", "all_cluster_labels")}

    return {
        "status": "complete",
        "filename": file.filename,
        "cleaning": cleaning,
        "eda": eda_report,
        "segmentation": seg_payload,
        "prediction": {
            "metrics": rf_result["metrics"],
            "feature_importances": rf_result["feature_importances"],
            "score_distribution": rf_result["score_distribution"],
            "roc_curve": rf_result["roc_curve"],
            "score_by_cluster": score_by_cluster,
        },
        "baseline": baseline_result,
    }


@app.post("/api/baseline")
async def baseline_analysis(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 2:
        raise HTTPException(status_code=400, detail="CSV com poucos registros.")
    result = run_baseline(df)
    return {"status": "baseline_computed", "filename": file.filename, "cleaning": cleaning, **result}
