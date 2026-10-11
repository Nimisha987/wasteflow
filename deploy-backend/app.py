from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException

BASE = Path(__file__).resolve().parent / "output"

fill_path = BASE / "fill_estimates.csv"
collection_path = BASE / "collection_recommendations.csv"

app = FastAPI(
    title="WasteFlow AI API",
    description="Prototype API using historical simulated estimates",
    version="0.1.0",
)

def load_data():
    if not fill_path.exists() or not collection_path.exists():
        raise RuntimeError("Prototype CSV files not found. Run fill_prototype.py first.")

    fill = pd.read_csv(fill_path)
    collections = pd.read_csv(collection_path)
    fill["bin_id"] = fill["bin_id"].astype(str)
    collections["bin_id"] = collections["bin_id"].astype(str)
    return fill, collections

@app.get("/")
def home():
    return {
        "message": "WasteFlow AI API is running",
        "data_status": "historical simulation; not live sensor data",
        "docs": "/docs",
    }

@app.get("/bins")
def list_bins():
    fill, _ = load_data()
    latest = (
        fill.sort_values("date")
        .groupby(["bin_id", "ward_name"], as_index=False)
        .tail(1)
        .sort_values("bin_id")
    )
    return {
        "count": len(latest),
        "data_status": "SIMULATED historical estimates",
        "bins": latest[
            ["bin_id", "ward_name", "capacity_liters", "date", "estimated_fill_pct"]
        ].to_dict(orient="records"),
    }

@app.get("/bins/{bin_id}")
def get_bin(bin_id: str):
    fill, collections = load_data()
    history = fill[fill["bin_id"] == bin_id].sort_values("date")

    if history.empty:
        raise HTTPException(status_code=404, detail="Bin ID not found")

    latest = history.iloc[-1]
    future = collections[collections["bin_id"] == bin_id]
    next_collection = (
        future.sort_values("estimated_collection_date").iloc[0]["estimated_collection_date"]
        if not future.empty else None
    )

    return {
        "bin_id": bin_id,
        "ward_name": latest["ward_name"],
        "capacity_liters": int(latest["capacity_liters"]),
        "estimated_fill_pct": float(latest["estimated_fill_pct"]),
        "as_of_date": str(latest["date"]),
        "next_simulated_collection_date": (
            str(next_collection) if next_collection is not None else None
        ),
        "data_status": "SIMULATED historical estimate; not a live reading",
    }


@app.get("/recommendations")
def get_recommendations():
    fill, collections = load_data()

    if collections.empty:
        return {
            "count": 0,
            "data_status": "SIMULATED historical schedule; not live data",
            "recommendations": [],
        }

    # Latest simulated fill estimate for each bin
    latest_fill = (
        fill.sort_values("date")
        .groupby("bin_id", as_index=False)
        .tail(1)
    )

    # Earliest scheduled collection date for each bin
    next_collection = (
        collections.sort_values("estimated_collection_date")
        .drop_duplicates(subset=["bin_id"], keep="first")
    )

    result = next_collection.merge(
        latest_fill[["bin_id", "estimated_fill_pct", "date"]],
        on="bin_id",
        how="left",
    )

    result["estimated_fill_pct"] = result["estimated_fill_pct"].fillna(0)
    result["priority"] = result["estimated_fill_pct"].apply(
        lambda x: "HIGH" if x >= 80 else ("MEDIUM" if x >= 60 else "LOW")
    )

    result = result.sort_values(
        ["estimated_fill_pct", "estimated_collection_date"],
        ascending=[False, True],
    )

    return {
        "count": len(result),
        "data_status": "SIMULATED historical estimates; not live sensor data",
        "recommendations": result[
            [
                "bin_id",
                "ward_name",
                "estimated_fill_pct",
                "priority",
                "estimated_collection_date",
                "threshold_pct",
                "note",
            ]
        ].to_dict(orient="records"),
    }


@app.get("/model-metrics")
def get_model_metrics():
    import json

    metrics_path = BASE / "evaluation_metrics.json"
    if not metrics_path.exists():
        raise HTTPException(status_code=404, detail="Model metrics file not found")

    with open(metrics_path, "r") as f:
        metrics = json.load(f)

    return {
        "data_status": "Synthetic dataset; evaluation metrics are for prototype demonstration",
        "metrics": metrics,
    }

@app.get("/forecast-data")
def get_forecast_data():
    import pandas as pd

    path = BASE / "test_predictions.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Predictions file not found")

    df = pd.read_csv(path, parse_dates=["date"])
    dates = sorted(df["date"].unique())[-14:]
    recent = df[df["date"].isin(dates)].copy()

    daily = recent.groupby("date", as_index=False).agg(
        predicted_kg=("predicted_waste_kg", "sum"),
        actual_kg=("waste_generated_kg", "sum")
    )

    latest = recent["date"].max()
    wards = recent[recent["date"] == latest].groupby(
        "ward_name", as_index=False
    ).agg(predicted_kg=("predicted_waste_kg", "sum"))

    return {
        "data_status": "Historical test predictions on synthetic data, not a live future forecast",
        "daily": [
            {
                "date": row.date.strftime("%Y-%m-%d"),
                "predicted_tonnes": round(row.predicted_kg / 1000, 3),
                "actual_tonnes": round(row.actual_kg / 1000, 3)
            }
            for row in daily.itertuples()
        ],
        "wards": [
            {
                "ward_name": row.ward_name,
                "predicted_tonnes": round(row.predicted_kg / 1000, 3)
            }
            for row in wards.itertuples()
        ]
    }


@app.get("/scenario")
def get_scenario(uplift: float = 0, seg: float = 60):
    if not 0 <= uplift <= 80:
        raise HTTPException(status_code=400, detail="uplift must be between 0 and 80")
    if not 10 <= seg <= 95:
        raise HTTPException(status_code=400, detail="seg must be between 10 and 95")

    path = BASE / "test_predictions.csv"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Historical predictions file not found")

    df = pd.read_csv(path, parse_dates=["date"])
    latest_date = df["date"].max()
    latest = df[df["date"] == latest_date]
    base_kg = float(latest["predicted_waste_kg"].sum())

    scenario_kg = base_kg * (1 + uplift / 100)
    return {
        "data_status": "Illustrative scenario based on historical synthetic model predictions; not live data",
        "reference_date": latest_date.strftime("%Y-%m-%d"),
        "uplift_pct": uplift,
        "sorting_pct": seg,
        "reference_predicted_tonnes": round(base_kg / 1000, 3),
        "scenario_estimated_tonnes": round(scenario_kg / 1000, 3),
        "note": "Sorting percentage is recorded as a scenario input; this endpoint does not estimate its causal effect."
    }
