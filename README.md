# Vitaliza · A Arquitetura da Retenção Preditiva

Artefato de tecnologia que sustenta, reproduz e demonstra empiricamente o trabalho **"Customer Segmentation Report — Vitaliza"**.

## Estrutura

```
├── backend/
│   ├── main.py                          ← API FastAPI (deploy no Render)
│   ├── requirements.txt
│   ├── runtime.txt
│   └── services/
│       ├── data_loader.py               ← carregamento e validação do CSV
│       ├── eda.py                       ← EDA (páginas 5, 6, 7 do relatório)
│       ├── kmeans_segmentation.py       ← K-Means — segmentação e personas
│       ├── random_forest_churn.py       ← Random Forest — predição de churn
│       └── business_rules_baseline.py  ← Baseline por regra de negócio
├── frontend/
│   ├── index.html                       ← interface (deploy na Vercel)
│   ├── style.css
│   └── app.js
├── notebooks/
│   └── eda_churn.ipynb
└── vercel.json
```

## Algoritmos e seus papéis

| Algoritmo | Papel único |
|---|---|
| **K-Means** | Segmentação comportamental · identificação de 4 personas |
| **Random Forest** | Predição individual de churn · score de risco · feature importance |
| **Baseline por regra** | Validação interpretativa · controle metodológico · ponte com negócio |

## Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/` | Health check |
| POST | `/eda` | EDA completa (páginas 5, 6, 7) |
| POST | `/segment` | K-Means (K configurável, padrão 4) |
| POST | `/train` | Treina Random Forest |
| POST | `/segment-and-score` | Pipeline completo: EDA + K-Means + RF + Baseline |
| POST | `/baseline` | Baseline por regra de negócio |
| POST | `/predict` | Score individual de churn |

## Deploy

### Backend (Render)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port $PORT
```

1. Acesse https://render.com → New → Web Service
2. Root Directory: `backend`
3. Build: `pip install -r requirements.txt`
4. Start: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Copie a URL e atualize `API_URL` em `frontend/app.js`

### Frontend (Vercel)

```bash
npm i -g vercel
vercel
```

Vercel serve o repositório raiz. O `vercel.json` redireciona `/` para `frontend/index.html`.

### Teste local

```bash
cd backend
uvicorn main:app --reload
# API em http://localhost:8000
# Abra frontend/index.html diretamente no navegador
```

## Gráficos reproduzidos

| Página | Gráfico | Aba no app |
|---|---|---|
| 5 | Churn por duração de contrato | EDA |
| 5 | Janela crítica dos primeiros 30 dias | EDA |
| 6 | Fatores protetivos vs. churn | EDA |
| 7 | Hierarquia de drivers (correlação) | EDA |
| 8 | Tamanho e churn por cluster | Segmentação |
| 8 | Heatmap comparativo dos 4 segmentos | Segmentação |

## 4 Personas

- **C0 · Recém-chegado em fuga** — Alto churn · ação imediata
- **C1 · Leal anual** — Baixo churn · preservação
- **C2 · Engajado mensal** — Médio churn · migração assistida
- **C3 · Médio em trânsito** — Principal caso de uso do Random Forest

## .gitignore

```
model.pkl
dataset/
*.csv
__pycache__/
.env
.vercel
```
