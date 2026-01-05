import json
import io
import csv
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response, HTTPException, Form, File, UploadFile
from fastapi.responses import JSONResponse
from utils import create_error_log 
from typing import Optional

app = FastAPI(title="WATTever API")
API_PREFIX = "/api"

# "Βάση δεδομένων" στη μνήμη
db_points = []
db_sessions = [] 
db_status_changes = [] 

def flatten_data():
    try:
        with open('part1.json', 'r', encoding='utf-8') as f:
            raw_data = json.load(f)
            points = []
            for location in raw_data:
                for station in location.get("stations", []):
                    for outlet in station.get("outlets", []):
                        points.append({
                            "providerName": "WATTever",
                            "pointid": str(outlet.get("id")),
                            "lon": str(location.get("longitude")),
                            "lat": str(location.get("latitude")),
                            "status": (outlet.get("status") or "available").lower(),
                            "cap": outlet.get("kilowatts") or 0,
                            "kwhprice": 0.25,
                            "reservationendtime": None
                        })
            return points
    except FileNotFoundError: return []

# --- 1. /admin/healthcheck ---
@app.get(f"{API_PREFIX}/admin/healthcheck")
async def health_check(request: Request):
    online = len([p for p in db_points if p['status'] != 'offline'])
    return {
        "status": "OK",
        "dbconnection": "mock_connection_string",
        "n_charge_points": len(db_points),
        "n_charge_points_online": online,
        "n_charge_points_offline": len(db_points) - online
    }

# --- 2. /admin/resetpoints ---
@app.post(f"{API_PREFIX}/admin/resetpoints")
async def reset_points():
    global db_points, db_sessions, db_status_changes
    db_points = flatten_data()
    db_sessions = []
    db_status_changes = []
    return {"status": "OK"}

# --- 3. /admin/addpoints (ΤΟ ΕΠΑΝΕΦΕΡΑ) ---
@app.post(f"{API_PREFIX}/admin/addpoints")
async def add_points(file: UploadFile = File(...)):
    global db_points
    if file.content_type != 'text/csv':
        raise HTTPException(status_code=400, detail="MIME type must be text/csv")
    
    content = await file.read()
    decoded = content.decode('utf-8')
    reader = csv.DictReader(io.StringIO(decoded))
    count = 0
    for row in reader:
        db_points.append(row)
        count += 1
    return {"status": "OK", "added": count}

# --- 4. /points ---
@app.get(f"{API_PREFIX}/points")
async def get_points(request: Request, status: str = None, format: str = "json"):
    data = db_points
    if status:
        valid = ["available", "charging", "reserved", "malfunction", "offline"]
        if status not in valid:
            return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid status"))
        data = [p for p in data if p.get("status") == status]
    
    if format == "csv":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(data)
        # Αντικατάσταση για το delimiter ", " βάσει εκφώνησης
        return Response(content=output.getvalue().replace(',', ', '), media_type="text/csv")
    return data

# --- 5. /point/{id} ---
@app.get(API_PREFIX + "/point/{point_id}")
async def get_point_details(request: Request, point_id: str):
    point = next((p for p in db_points if str(p["pointid"]) == point_id), None)
    if not point:
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    res_time = point.get("reservationendtime") or datetime.now().strftime("%Y-%m-%d %H:%M")
    return {**point, "reservationendtime": res_time}

# --- 6. /reserve/{id} (Διπλό path για προαιρετικό minutes) ---
@app.post(API_PREFIX + "/reserve/{point_id}")
@app.post(API_PREFIX + "/reserve/{point_id}/{minutes}")
async def reserve_point(request: Request, point_id: str, minutes: int = 30):
    point = next((p for p in db_points if str(p["pointid"]) == point_id), None)
    if not point or point["status"] != "available":
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Cannot reserve"))
    
    actual_minutes = min(60, minutes)
    end_time = datetime.now() + timedelta(minutes=actual_minutes)
    
    db_status_changes.append({
        "timeref": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "pointid": point_id,
        "old_state": point["status"],
        "new_state": "reserved"
    })
    
    point["status"] = "reserved"
    point["reservationendtime"] = end_time.strftime("%Y-%m-%d %H:%M")
    
    return {"pointid": point_id, "status": "reserved", "reservationendtime": point["reservationendtime"]}

# --- 7. /updpoint/{id} (Βελτιωμένο) ---
@app.post(API_PREFIX + "/updpoint/{point_id}")
async def update_point(request: Request, point_id: str, status: Optional[str] = Form(None), kwhprice: Optional[float] = Form(None)):
    # Βρίσκουμε το σημείο
    point = next((p for p in db_points if str(p["pointid"]) == point_id), None)
    
    if not point:
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    # Ενημερώνουμε το status ΜΟΝΟ αν δωθεί τιμή και αν δεν είναι η προεπιλεγμένη "string" του Swagger
    if status and status.lower() != "string":
        point["status"] = status.lower()
    
    # Ενημερώνουμε την τιμή αν δωθεί
    if kwhprice is not None:
        point["kwhprice"] = kwhprice
        
    return {
        "pointid": point["pointid"],
        "status": point["status"],
        "kwhprice": point["kwhprice"]
    }

# --- 8. /newsession (Έναρξη - Διορθωμένο) ---
@app.post(API_PREFIX + "/newsession")
async def new_session(pointid: str = Form(...), vehicleid: str = Form(...), userid: str = Form(...)):
    # Βρίσκουμε τον φορτιστή
    point = next((p for p in db_points if str(p["pointid"]) == pointid), None)
    
    if not point:
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))

    # ΚΑΤΑΓΡΑΦΗ ΜΕΤΑΒΟΛΗΣ (για το /pointstatus)
    db_status_changes.append({
        "timeref": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "pointid": pointid,
        "old_state": point["status"], # π.χ. available ή reserved
        "new_state": "charging"
    })
    
    # Αλλαγή κατάστασης στον φορτιστή
    point["status"] = "charging"
    
    # Καταγραφή του Session
    session = {
        "session_id": len(db_sessions) + 1,
        "pointid": pointid,
        "vehicleid": vehicleid,
        "userid": userid,
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M")
    }
    db_sessions.append(session)
    
    return {"status": "OK"}

# --- 9. /sessions/{id}/{from}/{to} ---
@app.get(API_PREFIX + "/sessions/{point_id}/{date_from}/{date_to}")
async def get_sessions(point_id: str, date_from: str, date_to: str):
    results = [s for s in db_sessions if s["pointid"] == point_id]
    return results

# --- 10. /pointstatus/{id}/{from}/{to} ---
@app.get(API_PREFIX + "/pointstatus/{point_id}/{date_from}/{date_to}")
async def get_point_status(point_id: str, date_from: str, date_to: str):
    results = [s for s in db_status_changes if s["pointid"] == point_id]
    return results

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=create_error_log(request, exc.status_code, exc.detail))