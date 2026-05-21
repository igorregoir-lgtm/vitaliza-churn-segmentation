"""
Script de treino — rode isso localmente para gerar o model.pkl
que será carregado pela API.

Execute: python train_model.py
"""
import pandas as pd
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR.parent / "dataset" / "gym_churn_us.csv"
MODEL_PATH = BASE_DIR / "model.pkl"

# --------------------------------------------------
# 1. CARREGA
# --------------------------------------------------
df = pd.read_csv(DATA_PATH)
print(f"Shape: {df.shape}")
print(df.head())

# --------------------------------------------------
# 2. LIMPA
# --------------------------------------------------
df = df.drop_duplicates()
df = df.dropna()
print(f"\nShape após limpeza: {df.shape}")

# --------------------------------------------------
# 3. FEATURES
# --------------------------------------------------
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
TARGET = "Churn"

X = df[FEATURES]
y = df[TARGET]

print(f"\nDistribuição do churn:\n{y.value_counts()}")

# --------------------------------------------------
# 4. TREINO
# --------------------------------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

model = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
model.fit(X_train, y_train)

# --------------------------------------------------
# 5. AVALIA
# --------------------------------------------------
y_pred  = model.predict(X_test)
y_proba = model.predict_proba(X_test)[:, 1]

print("\n--- Classification Report ---")
print(classification_report(y_test, y_pred))
print(f"ROC-AUC: {roc_auc_score(y_test, y_proba):.4f}")

# --------------------------------------------------
# 6. SALVA
# --------------------------------------------------
joblib.dump(model, MODEL_PATH)
print(f"\nmodelo salvo em {MODEL_PATH} ✓")
