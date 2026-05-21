from io import BytesIO
import pandas as pd
from fastapi import HTTPException, UploadFile

FEATURES = [
    "Lifetime",
    "Avg_class_frequency_current_month",
    "Age",
    "Contract_period",
    "Month_to_end_contract",
    "Avg_class_frequency_total",
    "Avg_additional_charges_total",
    "Group_visits",
    "Promo_friends",
    "Partner",
    "Near_Location",
]

BINARY_FEATURES = ["Group_visits", "Promo_friends", "Partner", "Near_Location"]

FEATURE_LABELS = {
    "Lifetime": "Tempo como cliente",
    "Avg_class_frequency_current_month": "Frequência atual",
    "Age": "Idade",
    "Contract_period": "Duração do contrato",
    "Month_to_end_contract": "Meses até vencer",
    "Avg_class_frequency_total": "Frequência histórica",
    "Avg_additional_charges_total": "Gastos extras",
    "Group_visits": "Desafios em grupo",
    "Promo_friends": "Indicação de amigos",
    "Partner": "Convênio empresarial",
    "Near_Location": "Mora perto",
    "gender": "Gênero",
    "Phone": "Tel. cadastrado",
}

DEFAULT_FEATURE_VALUES = {
    "Lifetime": 4,
    "Avg_class_frequency_current_month": 2.0,
    "Age": 29,
    "Contract_period": 6,
    "Month_to_end_contract": 4.0,
    "Avg_class_frequency_total": 2.0,
    "Avg_additional_charges_total": 150.0,
    "Group_visits": 0,
    "Promo_friends": 0,
    "Partner": 0,
    "Near_Location": 1,
}


async def read_uploaded_csv(file: UploadFile) -> pd.DataFrame:
    if not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Envie um arquivo CSV válido.")
    try:
        contents = await file.read()
        return pd.read_csv(BytesIO(contents))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Não foi possível ler o CSV: {exc}") from exc


def validate_required_columns(df: pd.DataFrame) -> None:
    required = FEATURES + ["Churn"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"CSV sem colunas obrigatórias: {', '.join(missing)}",
        )


def clean_dataset(df: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    """Limpa o dataset mantendo todas as colunas (inclusive extras como gender, Phone)."""
    validate_required_columns(df)
    rows_original = int(len(df))
    null_values = int(df[FEATURES + ["Churn"]].isna().sum().sum())
    duplicated_rows = int(df.duplicated().sum())
    # Drop duplicates/nulls mas mantém todas as colunas para EDA completa
    clean_df = df.drop_duplicates()
    clean_df = clean_df.dropna(subset=FEATURES + ["Churn"]).reset_index(drop=True)
    return clean_df, {
        "rows_original": rows_original,
        "rows_clean": int(len(clean_df)),
        "duplicates_removed": duplicated_rows,
        "null_values": null_values,
    }
