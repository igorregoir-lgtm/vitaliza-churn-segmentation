import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from services.data_loader import (
    read_uploaded_csv, clean_dataset,
    FEATURES, FEATURE_LABELS, DEFAULT_FEATURE_VALUES,
)
from services.eda import build_eda_report
from services.kmeans_segmentation import run_kmeans
from services.random_forest_churn import train_random_forest, get_score_by_cluster
from services.business_rules_baseline import run_baseline

app = FastAPI(title="Vitaliza API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api")
def health():
    return {"status": "ok", "product": "Vitaliza — A Arquitetura da Retenção Preditiva"}


@app.post("/api/eda")
async def analyze_csv(file: UploadFile = File(...)):
    raw = await read_uploaded_csv(file)
    df, cleaning = clean_dataset(raw)
    if len(df) < 2:
        raise HTTPException(status_code=400, detail="CSV com poucos registros válidos.")
    report = build_eda_report(df)
    return {"status": "analyzed", "filename": file.filename, "cleaning": cleaning, **report}


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
