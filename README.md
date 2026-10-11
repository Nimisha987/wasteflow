# ♻️ WasteFlow AI
### AI-Powered Smart Waste Management for Sustainable Cities

WasteFlow AI is an AI-powered smart waste management prototype that demonstrates how historical data, machine learning, and cloud-based workflows can support better urban waste collection planning.

Traditional waste collection often relies on fixed schedules and manual observations. This can contribute to overflowing bins, unnecessary collection trips, inefficient use of vehicles and staff, and avoidable fuel consumption. WasteFlow AI explores a data-driven alternative by presenting bin fill-level estimates, collection priorities, waste trends, forecasting views, and scenario-based planning through an interactive dashboard.

> **Data note:** The current prototype uses historical simulated data. It does not currently receive live readings from physical bin sensors or a live IoT system.

---

##  Problem Statement

Urban waste collection teams face challenges such as:

- Fixed collection schedules that may not reflect the estimated need at each bin.
- Difficulty identifying which bins may require attention first.
- Limited visibility into historical waste patterns and trends.
- Inefficient allocation of vehicles, staff, time, and fuel.
- A need for better data-informed planning.

##  Our Solution

WasteFlow AI uses historical simulated waste data and machine-learning workflows to demonstrate how collection planning can be made more data-informed. The dashboard brings together bin-level estimates, collection recommendations, forecasting views, scenario simulation, and model evaluation outputs.

The system is designed as a decision-support prototype. It does not automatically dispatch vehicles or replace the judgement of sanitation teams.

##  Key Features

- **Bin Fill-Level Estimation:** View estimated bin fill levels based on the prototype's data and model workflow.
- **Collection Recommendations:** Review suggested collection priorities and identify bins that may need attention.
- **Waste Forecasting and Analytics:** Explore waste patterns and available forecasting outputs.
- **Interactive Dashboard:** Access bin information, recommendations, and analytics in one interface.
- **Scenario Simulation:** Explore hypothetical changes and review the resulting planning outputs.
- **Model Evaluation:** Review model metrics to understand prediction performance.

*Feature outputs depend on the data and artifacts available in the deployed prototype.*

---

##  Architecture

The project combines a machine-learning and data-storage workflow with a separately hosted web application.

```text
Historical Simulated Waste Data
              |
              v
      Data Processing / Analysis
              |
              v
       Amazon S3 Storage
              |
              v
 Amazon SageMaker ML Experimentation
       and Model Evaluation
              |
              v
      Prepared Data / Outputs
              |
              v
    FastAPI Backend (Render)
              |
        REST APIs / JSON
              |
              v
   Web Frontend (Vercel)
              |
              v
     WasteFlow AI Dashboard
```

This diagram describes the high-level workflow; it does not imply that every step runs as an automated, live AWS pipeline. The current web application is hosted on Vercel (frontend) and Render (backend).

##  AWS Usage

### Amazon SageMaker
Used as a cloud-based environment for machine-learning experimentation, data analysis, and model evaluation.

### Amazon S3
Used to store project datasets and related data artifacts, providing a centralized storage location for the project workflow.

### Potential Future AWS Services
The architecture could be extended with:
- **AWS Lambda** for event-driven data processing.
- **Amazon API Gateway** for managed API access.
- **Amazon CloudWatch** for logging and monitoring.
- **AWS IoT Core** for future integration with physical bin sensors.

These additional services are proposed future enhancements, not components currently deployed in the prototype.

---

##  Technology Stack

| Component | Technology |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | Python, FastAPI |
| API format | REST APIs, JSON |
| ML experimentation | Amazon SageMaker |
| Data storage | Amazon S3 |
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Version control | Git, GitHub |

##  Dataset and Model Evaluation

The prototype uses approximately **219,000 historical simulated waste-data records**, representing **300 bins across five Delhi wards** over **2018–2019**.

The data supports experimentation with waste patterns, bin fill-level estimates, collection priorities, and forecasting. Model evaluation outputs are available through the prototype to help assess prediction performance.

### Important Data Disclaimer
The dataset is simulated historical data, not verified live municipal data. The application does not currently use physical bin sensors, live GPS tracking, or live IoT readings. Model outputs should not be interpreted as live operational measurements or as validated city-wide predictions. Real-world performance would need to be validated against reliable field data.

---

##  Live Project Links

- **Frontend Dashboard:** https://wasteflow-bice.vercel.app/
- **Backend API:** https://wasteflow-4o45.onrender.com/
- **Interactive API Documentation:** https://wasteflow-4o45.onrender.com/docs
- **GitHub Repository:** https://github.com/Nimisha987/wasteflow

##  API Endpoints

| Endpoint | Purpose |
|---|---|
| `/` | Root or health response |
| `/bins` | Retrieve bin records |
| `/bins/{bin_id}` | Retrieve a specific bin record |
| `/recommendations` | Retrieve collection recommendations |
| `/model-metrics` | Retrieve model evaluation metrics |
| `/forecast-data` | Retrieve forecasting data |
| `/scenario` | Access scenario simulation functionality |

Endpoint responses depend on the deployed backend and its prepared data.

---

##  Run the Backend Locally

### Prerequisites
- Python
- Git
- The project repository and its required data/configuration files

### 1. Clone the repository

```bash
git clone https://github.com/Nimisha987/wasteflow.git
cd wasteflow
```

### 2. Open the backend directory

```bash
cd deploy-backend
```

### 3. Install dependencies

If a `requirements.txt` file is present:

```bash
pip install -r requirements.txt
```

If it is not present, install the dependencies listed in the project's actual configuration.

### 4. Start the FastAPI application

```bash
uvicorn app:app --reload
```

The local API should be available at:

- Base URL: `http://127.0.0.1:8000`
- API documentation: `http://127.0.0.1:8000/docs`

Local execution may require configuration or data files used by the backend. Configure the required environment variables and file paths for your setup.

---

##  Intended Users

WasteFlow AI is designed for:
- Municipal corporations and urban local bodies.
- Sanitation departments.
- Waste collection agencies.
- Smart-city administrators.
- Urban planning teams.
- Researchers exploring AI-based sustainability solutions.

##  Expected Benefits

The project aims to demonstrate how data-informed planning may help teams:
- Identify bins that may need collection.
- Prioritize collection activities.
- Understand historical waste trends.
- Plan vehicle and staff allocation more effectively.
- Reduce avoidable trips and fuel use, subject to real-world validation.
- Support cleaner and more sustainable urban environments.

These are intended benefits; actual operational impact has not yet been established through a municipal field deployment.

##  Future Enhancements

1. **Real-Time IoT Monitoring:** Integrate physical fill-level sensors and AWS IoT Core.
2. **GPS-Based Route Optimization:** Consider vehicle locations, road networks, and collection priorities.
3. **Critical-Bin Alerts:** Notify teams when monitored bins cross configured thresholds.
4. **Production Database:** Store bin records, collection history, and operational data persistently.
5. **Cloud Monitoring and Processing:** Evaluate AWS Lambda, Amazon API Gateway, and Amazon CloudWatch for future deployments.
6. **Real-World Validation:** Test model predictions against verified municipal data and measured fill levels.
7. **Waste Composition Analysis:** Explore waste-to-energy estimates only when reliable composition data and validated methods are available.
8. **Operational Feedback:** Use field observations and collection outcomes to assess and improve recommendations.

##  Current Limitations

- Uses historical simulated data rather than verified live municipal data.
- No physical bin sensors or live IoT feed are connected.
- No live GPS-based vehicle tracking or route optimization is currently implemented.
- Recommendations support planning; they do not automatically dispatch vehicles.
- The frontend and backend are hosted on Vercel and Render, respectively; AWS supports the data and ML workflow.
- Real-world performance and environmental benefits require further validation.

##  Vision

Our vision is to help cities move from purely schedule-based waste collection toward more predictive, data-informed planning. By combining machine learning, cloud-based data workflows, and accessible dashboards, WasteFlow AI aims to help sanitation teams make better-informed decisions and support cleaner, smarter, and more sustainable cities.

##  License

No license is specified in this repository README. Add a `LICENSE` file after selecting the license under which you want to distribute the project.

---

**WasteFlow AI — Smarter Waste Collection. Better Resource Planning. Cleaner Cities. ♻️**
