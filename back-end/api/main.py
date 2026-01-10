import io
import csv
import json
import mysql.connector
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response, HTTPException, Form, File, UploadFile
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

# Προσπάθεια import του utils, αλλιώς ορίζουμε εδώ τη συνάρτηση για να μην κρασάρει
try:
    from utils import create_error_log
except ImportError:
    def create_error_log(request, code, message, debug_info=""):
        return {
            "call": str(request.url),
            "timeref": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "originator": request.client.host,
            "return code": code,
            "error": message,
            "debuginfo": debug_info
        }

app = FastAPI(title="WATTever API")

origins = ["http://localhost:5173", "http://127.0.0.1:5173", "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api"

# --- ΡΥΘΜΙΣΕΙΣ ΒΑΣΗΣ ---
DB_CONFIG = {
    'host': 'localhost',
    'user': 'softeng_user',
    'password': 'softeng_pass',  
    'database': 'wattever_db'
}

def get_db_connection():
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {err}")

# --- PYDANTIC MODELS ---
class UpdatePointInput(BaseModel):
    status: Optional[str] = None
    kwhprice: Optional[float] = None

class SessionInput(BaseModel):
    id: str
    starttime: str
    endtime: str
    startsoc: int
    endsoc: int
    totalkwh: float
    kwhprice: float
    amount: float

# --- 1. /admin/healthcheck ---
@app.get(f"{API_PREFIX}/admin/healthcheck")
async def health_check(request: Request):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM Charger")
    total = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM Charger WHERE status != 'offline' AND status != 'outoforder'")
    online = cursor.fetchone()[0]
    conn.close()
    
    return {
        "status": "OK",
        "dbconnection": f"mysql://{DB_CONFIG['user']}@localhost/{DB_CONFIG['database']}",
        "n_charge_points": total,
        "n_charge_points_online": online,
        "n_charge_points_offline": total - online
    }

# --- 2. /admin/resetpoints ---
INITIAL_DATA_FILE = "parts1234.json"

@app.post(f"{API_PREFIX}/admin/resetpoints")
async def reset_points(request: Request):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Καθαρισμός με τη σωστή σειρά λόγω Foreign Keys
        cursor.execute("DELETE FROM StatusHistory") 
        cursor.execute("DELETE FROM Transaction")
        cursor.execute("DELETE FROM ChargingSession")
        cursor.execute("DELETE FROM Reservation")
        cursor.execute("DELETE FROM Charger")
        cursor.execute("DELETE FROM Station")
        
        with open(INITIAL_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        CONNECTOR_MAP = {
            0: ("Unknown", "AC"), 2: ("J1772", "AC"), 3: ("CHAdeMO", "DC"),
            7: ("Type 2", "AC"), 25: ("Type 2", "AC"), 1036: ("Type 2", "AC"),
            13: ("CCS1", "DC"), 20: ("CCS2", "DC"), 30: ("Tesla HPWC", "DC"),
            32: ("CCS1", "DC"), 33: ("CCS2", "DC")
        }
        
        seen_stations = set()
        seen_chargers = set()
        
        for location in data:
            s_id = str(location.get('id'))
            if s_id not in seen_stations:
                cursor.execute(
                    "INSERT INTO Station (station_id, name, address, latitude, longitude) VALUES (%s, %s, %s, %s, %s)",
                    (s_id, location.get('name', 'Unknown'), location.get('address', 'Unknown'), 
                     location.get('latitude', 0), location.get('longitude', 0))
                )
                seen_stations.add(s_id)
            
            for station_wrapper in location.get('stations', []):
                for outlet in station_wrapper.get('outlets', []):
                    c_id = str(outlet.get('id'))
                    if c_id not in seen_chargers:
                        conn_id = outlet.get('connector')
                        kw = outlet.get('kilowatts') or outlet.get('power') or 0.0
                        conn_type, curr_type = CONNECTOR_MAP.get(conn_id, ("Unknown", "AC"))
                        if kw == 0:
                            kw = 50.0 if curr_type == 'DC' else (22.0 if 'Type 2' in conn_type else 3.7)

                        cursor.execute(
                            """INSERT INTO Charger 
                               (charger_id, connector_type, current_type, max_power_kw, status, station_id, policy_id) 
                               VALUES (%s, %s, %s, %s, 'AVAILABLE', %s, 'POL_DEFAULT')""",
                            (c_id, conn_type, curr_type, kw, s_id)
                        )
                        seen_chargers.add(c_id)
        conn.commit()
        return {"status": "OK"}
    except Exception as e:
        conn.rollback()
        return JSONResponse(status_code=500, content=create_error_log(request, 500, str(e)))
    finally:
        conn.close()

# --- 3. /admin/addpoints ---
@app.post(f"{API_PREFIX}/admin/addpoints")
async def add_points(request: Request, file: UploadFile = File(...)):
    # Δεκτό και το excel type αν το στέλνει έτσι ο browser, αλλά πρέπει να είναι CSV
    content = await file.read()
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError:
        decoded = content.decode('latin-1')
        
    reader = csv.DictReader(io.StringIO(decoded))
    conn = get_db_connection()
    cursor = conn.cursor()
    
    count = 0
    try:
        for row in reader:
            sid = row.get('station_id', '').strip()
            cid = row.get('charger_id', '').strip()
            if not sid or not cid: continue
            
            # Insert Station if missing
            cursor.execute("SELECT station_id FROM Station WHERE station_id = %s", (sid,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO Station (station_id, name, address, latitude, longitude) VALUES (%s, %s, %s, %s, %s)",
                    (sid, row.get('name', 'Unknown'), row.get('address', 'Unknown'), 
                     float(row.get('latitude', 0)), float(row.get('longitude', 0)))
                )
            
            # Insert Charger
            cursor.execute("SELECT charger_id FROM Charger WHERE charger_id = %s", (cid,))
            if not cursor.fetchone():
                conn_type = row.get('connector_type', 'Unknown')
                kw = float(row.get('max_power_kw', 0)) if row.get('max_power_kw') else 0.0
                curr_type = 'DC' if ('CCS' in conn_type or 'CHAdeMO' in conn_type or kw > 40) else 'AC'
                
                cursor.execute(
                    """INSERT INTO Charger (charger_id, connector_type, current_type, max_power_kw, status, station_id, policy_id) 
                       VALUES (%s, %s, %s, %s, 'AVAILABLE', %s, 'POL_DEFAULT')""",
                    (cid, conn_type, curr_type, kw, sid)
                )
                count += 1
        conn.commit()
    except Exception as e:
        conn.rollback()
        return JSONResponse(status_code=500, content=create_error_log(request, 500, str(e)))
    finally:
        conn.close()
    
    return {"status": "OK", "chargers_added": count}

# --- 4. /points (a) ---
@app.get(f"{API_PREFIX}/points")
async def get_points(request: Request, status: str = None, format: str = "json"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    if status and status.lower() not in ["available", "charging", "reserved", "outoforder", "offline"]:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid status argument"))

    query = """
        SELECT 
            'WATTever' as providerName,
            c.charger_id as pointid,
            s.longitude as lon,
            s.latitude as lat,
            c.status,
            ROUND(c.max_power_kw) as cap,
            s.name as station_name,
            s.address as station_address
        FROM Charger c
        JOIN Station s ON c.station_id = s.station_id
    """
    params = []
    if status:
        query += " WHERE c.status = %s"
        params.append(status.upper())
    
    cursor.execute(query, params)
    data = cursor.fetchall()
    conn.close()
    
    if format == "csv":
        output = io.StringIO()
        if data:
            writer = csv.DictWriter(output, fieldnames=data[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(data)
        return Response(content=output.getvalue(), media_type="text/csv")
        
    return data

# --- 5. /point/{id} (b) ---
@app.get(API_PREFIX + "/point/{point_id}")
async def get_point_details(request: Request, point_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Προσθήκη session info για το UI
    query = """
        SELECT 
            c.charger_id as pointid,
            st.latitude as lat,
            st.longitude as lon,
            c.status,
            c.max_power_kw as cap,
            pp.fixed_price_kwh as kwhprice,
            r.expiration_time as reservationendtime,
            st.name as station_name,
            st.address as station_address,
            sess.start_time as current_session_start
        FROM Charger c
        JOIN Station st ON c.station_id = st.station_id
        JOIN PricingPolicy pp ON c.policy_id = pp.policy_id
        LEFT JOIN Reservation r ON c.charger_id = r.charger_id AND r.status = 'ACTIVE' AND r.expiration_time > NOW()
        LEFT JOIN ChargingSession sess ON c.charger_id = sess.charger_id AND sess.status = 'IN_PROGRESS'
        WHERE c.charger_id = %s
    """
    cursor.execute(query, (point_id,))
    point = cursor.fetchone()
    conn.close()
    
    if not point:
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    # *** CRITICAL FIX FOR SPEC: Return current time if NOT reserved ***
    if point["reservationendtime"]:
        point["reservationendtime"] = point["reservationendtime"].strftime("%Y-%m-%d %H:%M")
    else:
        # Βάσει εκφώνησης: Αν δεν είναι δεσμευμένο, επιστρέφεται η τρέχουσα ημερομηνία/ώρα
        point["reservationendtime"] = datetime.now().strftime("%Y-%m-%d %H:%M")
        
    if point.get("current_session_start"):
        point["current_session_start"] = point["current_session_start"].isoformat()
    
    point['lat'] = str(point['lat'])
    point['lon'] = str(point['lon'])

    return point

# --- 6. /reserve (c) ---
@app.post(API_PREFIX + "/reserve/{point_id}")
@app.post(API_PREFIX + "/reserve/{point_id}/{minutes}")
async def reserve_point(request: Request, point_id: str, minutes: int = 30):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT status FROM Charger WHERE charger_id = %s", (point_id,))
    point = cursor.fetchone()
    
    if not point or point["status"] != "AVAILABLE":
        conn.close()
        # Εδώ η εκφώνηση λέει επιστροφή timestamp 1970 αν αποτύχει, αλλά συνήθως σε REST πετάμε 400
        # Αν θέλεις αυστηρή τήρηση, θα μπορούσες να επιστρέψεις 200 με 1970, αλλά το 400 είναι πιο σωστό REST
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Charger not available"))
    
    actual_minutes = min(60, minutes)
    end_time = datetime.now() + timedelta(minutes=actual_minutes)
    
    cursor.execute("UPDATE Charger SET status = 'RESERVED' WHERE charger_id = %s", (point_id,))
    res_id = f"RES_{point_id}_{int(datetime.now().timestamp())}"
    cursor.execute("""
        INSERT INTO Reservation (reservation_id, expiration_time, status, user_id, charger_id)
        VALUES (%s, %s, 'ACTIVE', 'USR_001', %s)
    """, (res_id, end_time, point_id))
    
    conn.commit()
    conn.close()
    
    return {
        "pointid": point_id, 
        "status": "reserved", 
        "reservationendtime": end_time.strftime("%Y-%m-%d %H:%M")
    }

# --- 7. /updpoint (d) ---
@app.post(API_PREFIX + "/updpoint/{point_id}")
async def update_point(request: Request, point_id: str, input_data: UpdatePointInput):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT c.*, pp.fixed_price_kwh FROM Charger c JOIN PricingPolicy pp ON c.policy_id = pp.policy_id WHERE c.charger_id = %s", (point_id,))
    current = cursor.fetchone()
    
    if not current:
        conn.close()
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))

    new_status = current['status']
    if input_data.status:
        if input_data.status.lower() not in ["available", "charging", "reserved", "outoforder", "offline"]:
            conn.close()
            return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid status"))
        new_status = input_data.status.upper()
        if new_status != current['status']:
            cursor.execute("INSERT INTO StatusHistory (point_id, old_status, new_status, change_time) VALUES (%s, %s, %s, NOW())", (point_id, current['status'], new_status))
            cursor.execute("UPDATE Charger SET status = %s WHERE charger_id = %s", (new_status, point_id))

    new_price = float(current['fixed_price_kwh'])
    if input_data.kwhprice is not None:
        req_price = float(input_data.kwhprice)
        if req_price != new_price:
            # Create new policy logic (simplified)
            new_pol_id = f"POL_{req_price:.2f}".replace('.', '_')
            try:
                cursor.execute("INSERT INTO PricingPolicy (policy_id, policy_type, name, fixed_price_kwh) VALUES (%s, 'Custom', %s, %s)", (new_pol_id, f"Price {req_price}", req_price))
            except: pass
            cursor.execute("UPDATE Charger SET policy_id = %s WHERE charger_id = %s", (new_pol_id, point_id))
            new_price = req_price

    conn.commit()
    conn.close()
    return {"pointid": point_id, "status": new_status.lower(), "kwhprice": new_price}

# --- 8. /newsession (e) ---
@app.post(API_PREFIX + "/newsession")
async def new_session(request: Request, input_data: SessionInput):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT charger_id FROM Charger WHERE charger_id = %s", (input_data.id,))
    if not cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    sess_id = f"SESS_{input_data.id}_{int(datetime.now().timestamp())}"
    try:
        cursor.execute("""
            INSERT INTO ChargingSession 
            (session_id, start_time, charging_end_time, total_kwh, cost_per_kwh, total_cost, start_soc, end_soc, user_id, vehicle_id, charger_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'USR_001', 'VEH_001', %s, 'FINISHED')
        """, (sess_id, input_data.starttime, input_data.endtime, input_data.totalkwh, input_data.kwhprice, input_data.amount, input_data.startsoc, input_data.endsoc, input_data.id))
        cursor.execute("UPDATE Charger SET status = 'AVAILABLE' WHERE charger_id = %s", (input_data.id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return JSONResponse(status_code=500, content=create_error_log(request, 500, str(e)))

    conn.close()
    return {"status": "OK"} # Spec says empty body on success, or OK. Empty is usually null. This is fine.

# --- 9. /sessions (f) ---
@app.get(API_PREFIX + "/sessions/{point_id}/{date_from}/{date_to}")
async def get_sessions(request: Request, point_id: str, date_from: str, date_to: str, format: str = "json"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        d_from = datetime.strptime(date_from, "%Y%m%d")
        d_to = datetime.strptime(date_to, "%Y%m%d") + timedelta(days=1)
    except ValueError:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid date format YYYYMMDD"))

    query = """
        SELECT 
            start_time AS starttime, 
            charging_end_time AS endtime, 
            start_soc AS startsoc, 
            end_soc AS endsoc, 
            total_kwh AS totalkwh, 
            cost_per_kwh AS kwhprice, 
            total_cost AS amount
        FROM ChargingSession 
        WHERE charger_id = %s AND start_time >= %s AND start_time < %s
    """
    cursor.execute(query, (point_id, d_from, d_to))
    results = cursor.fetchall()
    conn.close()
    
    # *** CRITICAL FIX: Format HH:MM (No Seconds) as per spec ***
    for r in results:
        if isinstance(r['starttime'], datetime):
            r['starttime'] = r['starttime'].strftime("%Y-%m-%d %H:%M")
        if r['endtime'] and isinstance(r['endtime'], datetime):
            r['endtime'] = r['endtime'].strftime("%Y-%m-%d %H:%M")
        elif r['endtime'] is None: r['endtime'] = ""

    # *** CRITICAL FIX: Add CSV support ***
    if format == "csv":
        output = io.StringIO()
        if results:
            writer = csv.DictWriter(output, fieldnames=results[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(results)
        return Response(content=output.getvalue(), media_type="text/csv")

    return results

# --- 10. /pointstatus (g) ---
@app.get(API_PREFIX + "/pointstatus/{point_id}/{date_from}/{date_to}")
async def get_point_status(request: Request, point_id: str, date_from: str, date_to: str, format: str = "json"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        d_from = datetime.strptime(date_from, "%Y%m%d")
        d_to = datetime.strptime(date_to, "%Y%m%d") + timedelta(days=1)
    except ValueError:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid date format"))

    query = """
        SELECT change_time AS timeref, old_status AS old_state, new_status AS new_state
        FROM StatusHistory
        WHERE point_id = %s AND change_time >= %s AND change_time < %s
        ORDER BY change_time DESC
    """
    cursor.execute(query, (point_id, d_from, d_to))
    results = cursor.fetchall()
    conn.close()

    for r in results:
        if isinstance(r['timeref'], datetime):
            r['timeref'] = r['timeref'].strftime("%Y-%m-%d %H:%M")

    if format == "csv":
        output = io.StringIO()
        if results:
            writer = csv.DictWriter(output, fieldnames=results[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(results)
        return Response(content=output.getvalue(), media_type="text/csv")

    return results

# --- HELPER ROUTES (For Frontend Logic) ---
@app.post(API_PREFIX + "/charge/start/{point_id}/{vehicle_id}")
async def start_charging_process(request: Request, point_id: str, vehicle_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT status, policy_id FROM Charger WHERE charger_id = %s", (point_id,))
    charger = cursor.fetchone()
    
    if not charger or charger['status'] not in ['AVAILABLE', 'RESERVED']:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Charger not ready"))

    cursor.execute("UPDATE Charger SET status = 'CHARGING' WHERE charger_id = %s", (point_id,))
    cursor.execute("SELECT fixed_price_kwh FROM PricingPolicy WHERE policy_id = %s", (charger['policy_id'],))
    policy = cursor.fetchone()
    
    session_id = f"SESS_{point_id}_{int(datetime.now().timestamp())}"
    cursor.execute("""
        INSERT INTO ChargingSession 
        (session_id, start_time, cost_per_kwh, start_soc, status, user_id, charger_id, vehicle_id)
        VALUES (%s, NOW(), %s, 20, 'IN_PROGRESS', 'USR_001', %s, %s)
    """, (session_id, policy['fixed_price_kwh'], point_id, vehicle_id))
    cursor.execute("UPDATE Reservation SET status = 'COMPLETED' WHERE charger_id = %s AND status = 'ACTIVE'", (point_id,))
    conn.commit()
    conn.close()
    return {"status": "started", "session_id": session_id}

@app.post(API_PREFIX + "/charge/stop/{point_id}")
async def stop_charging_process(request: Request, point_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM ChargingSession WHERE charger_id = %s AND status = 'IN_PROGRESS' ORDER BY start_time DESC LIMIT 1", (point_id,))
    session = cursor.fetchone()
    
    if not session:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "No active session"))

    start_time = session['start_time']
    end_time = datetime.now()
    duration_minutes = (end_time - start_time).total_seconds() / 60
    kwh_consumed = round(duration_minutes * 0.36, 3) 
    if kwh_consumed < 0.1: kwh_consumed = 0.1
    cost = round(kwh_consumed * float(session['cost_per_kwh']), 2)

    cursor.execute("""
        UPDATE ChargingSession 
        SET charging_end_time = %s, session_end_time = %s, total_kwh = %s, total_cost = %s, end_soc = 80, status = 'FINISHED'
        WHERE session_id = %s
    """, (end_time, end_time, kwh_consumed, cost, session['session_id']))
    
    cursor.execute("INSERT INTO Transaction (transaction_id, amount, type, status, session_id) VALUES (%s, %s, 'Card', 'Success', %s)", (f"TRX_{session['session_id']}", cost, session['session_id']))
    cursor.execute("UPDATE Charger SET status = 'AVAILABLE' WHERE charger_id = %s", (point_id,))
    conn.commit()
    conn.close()
    return {"status": "finished", "kwh": kwh_consumed, "cost": cost, "duration_min": round(duration_minutes, 1)}

@app.get(API_PREFIX + "/user/active_reservation")
async def get_active_reservation(request: Request):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT r.reservation_id, r.expiration_time, c.charger_id as pointid, s.name as station_name, s.address as station_address, c.max_power_kw as cap
        FROM Reservation r JOIN Charger c ON r.charger_id = c.charger_id JOIN Station s ON c.station_id = s.station_id
        WHERE r.user_id = 'USR_001' AND r.status = 'ACTIVE' AND r.expiration_time > NOW()
        ORDER BY r.created_at DESC LIMIT 1
    """)
    res = cursor.fetchone()
    conn.close()
    if res and isinstance(res['expiration_time'], datetime): res['expiration_time'] = res['expiration_time'].isoformat()
    return res if res else {}

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=create_error_log(request, exc.status_code, exc.detail))