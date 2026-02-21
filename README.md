# WATTever - EV Charging Station Management System ⚡

This repository contains the implementation of the Software Engineering course project (2025-2026) for the School of Electrical and Computer Engineering (ECE) at NTUA. The system manages the interoperability of Electric Vehicle (EV) charging stations.

## 📁 Project Structure

* **`api/`**: Contains the Backend (REST API) source code in Python (FastAPI) and the SSL certificates (`key.pem`, `cert.pem`) for secure HTTPS communication.
* **`frontend/`**: Contains the Frontend (User Interface) built with React and Vite.
* **`cli/`**: Contains the Command-Line Interface (`cli.py`), the automated demo script (`demo.py`), and auxiliary files (`passes.csv`).

---

## 🚀 How to Run

To run the project properly, you need to start the Backend and the Frontend simultaneously in two separate terminal windows.

### 1. Starting the Backend (REST API)

Open a terminal at the **root directory** of the project and execute the following command:

```bash
python3 -m uvicorn api.main:app --host 0.0.0.0 --port 9876 --ssl-keyfile api/key.pem --ssl-certfile api/cert.pem --reload
```

*The API will start running securely at: `https://localhost:9876/api`*

> **Note:** Because we are using self-signed certificates, the first time you open the API in your browser, you will need to bypass the security warning (e.g., Click "Advanced" -> "Proceed to localhost").

### 2. Starting the Frontend (React/Vite)

Open a **second terminal**, navigate into the `frontend` directory, and start the development server:

```bash
cd frontend
npm install
npm run dev
```

*Once it starts, it will provide a link (usually `https://localhost:5173`) that you can open in your browser to access the application's UI.*

---

## 🛠️ CLI & Demo Script

To test the Command-Line Interface or run the presentation scenario, open a new terminal, navigate into the `cli` directory, and run the demo script:

```bash
cd cli
python3 demo.py
```

This script will automatically execute all the required API calls step-by-step, simply waiting for you to press "Enter" to proceed to the next step.
