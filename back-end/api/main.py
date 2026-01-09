import io
import csv
import json
import mysql.connector
from datetime import datetime, timedelta
from fastapi import FastAPI, Request, Response, HTTPException, Form, File, UploadFile
from fastapi.responses import JSONResponse
from utils import create_error_log 
from typing import Optional
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="WATTever API")

origins = [
    "http://localhost:5173",  
    "http://127.0.0.1:5173",    
    "*"                         
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)

API_PREFIX = "/api"

# --- ΡΥΘΜΙΣΕΙΣ ΒΑΣΗΣ ΔΕΔΟΜΕΝΩΝ ---
# Προσοχή: Βάλε εδώ τον κωδικό που έφτιαξες πριν
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
        # Αν αποτύχει η σύνδεση, πετάμε λάθος που θα πιάσει το FastAPI
        raise HTTPException(status_code=500, detail=f"Database connection failed: {err}")
    
class UpdatePointInput(BaseModel):
    status: Optional[str] = None
    kwhprice: Optional[float] = None

class SessionData(BaseModel):
    id: str
    starttime: str
    endtime: str
    startsoc: int
    endsoc: int
    totalkwh: float
    kwhprice: float
    amount: float

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
    
    # Μετράμε συνολικούς σταθμούς
    cursor.execute("SELECT COUNT(*) FROM Charger")
    total_chargers = cursor.fetchone()[0]
    
    # Μετράμε ενεργούς (online) σταθμούς (δηλ. όχι 'offline' ή 'outoforder')
    cursor.execute("SELECT COUNT(*) FROM Charger WHERE status != 'offline' AND status != 'outoforder'")
    online_chargers = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        "status": "OK",
        "dbconnection": f"mysql://{DB_CONFIG['user']}@localhost/{DB_CONFIG['database']}",
        "n_charge_points": total_chargers,
        "n_charge_points_online": online_chargers,
        "n_charge_points_offline": total_chargers - online_chargers
    }

# --- 2. /admin/resetpoints (ΔΙΑΓΡΑΦΗ & ΕΠΑΝΑΦΟΡΑ) ---
# Ορίζουμε το μονοπάτι του αρχείου ως καθολική σταθερά (Hardwired)
INITIAL_DATA_FILE = "parts1234.json"

@app.post(f"{API_PREFIX}/admin/resetpoints")
async def reset_points():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. ΚΑΘΑΡΙΣΜΟΣ ΤΗΣ ΒΑΣΗΣ (Σβήνουμε τα πάντα με τη σωστή σειρά λόγω Foreign Keys)
        cursor.execute("DELETE FROM StatusHistory") # Αν έφτιαξες τον πίνακα
        cursor.execute("DELETE FROM Transaction")
        cursor.execute("DELETE FROM ChargingSession")
        cursor.execute("DELETE FROM Reservation")
        cursor.execute("DELETE FROM Charger")
        cursor.execute("DELETE FROM Station")
        # Σημείωση: Δεν σβήνουμε το PricingPolicy και τον User, αυτά είναι "σταθερά" (seed data)
        
        # 2. ΦΟΡΤΩΣΗ ΑΠΟ ΤΟ JSON (Hardwired file)
        with open(INITIAL_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # 3. ΕΠΑΝΕΙΣΑΓΩΓΗ ΔΕΔΟΜΕΝΩΝ
        # Λεξικό για Mapping Connector IDs -> (Type, AC/DC)
        CONNECTOR_MAP = {
            0: ("Unknown", "AC"), 2: ("J1772", "AC"), 3: ("CHAdeMO", "DC"),
            7: ("Type 2", "AC"), 25: ("Type 2", "AC"), 1036: ("Type 2", "AC"),
            13: ("CCS1", "DC"), 20: ("CCS2", "DC"), 30: ("Tesla HPWC", "DC"),
            32: ("CCS1", "DC"), 33: ("CCS2", "DC")
        }
        
        seen_stations = set()
        seen_chargers = set()
        
        for location in data:
            # --- Insert Station ---
            s_id = str(location.get('id'))
            if s_id not in seen_stations:
                cursor.execute(
                    "INSERT INTO Station (station_id, name, address, latitude, longitude) VALUES (%s, %s, %s, %s, %s)",
                    (s_id, location.get('name', 'Unknown'), location.get('address', 'Unknown'), 
                     location.get('latitude', 0), location.get('longitude', 0))
                )
                seen_stations.add(s_id)
            
            # --- Insert Chargers ---
            for station_wrapper in location.get('stations', []):
                for outlet in station_wrapper.get('outlets', []):
                    c_id = str(outlet.get('id'))
                    if c_id not in seen_chargers:
                        conn_id = outlet.get('connector')
                        kw = outlet.get('kilowatts') or outlet.get('power') or 0.0
                        
                        # Apply Data Cleaning Logic (όπως κάναμε νωρίτερα)
                        conn_type, curr_type = CONNECTOR_MAP.get(conn_id, ("Unknown", "AC"))
                        
                        # Διόρθωση μηδενικών KW
                        if kw == 0:
                            if curr_type == 'DC': kw = 50.0
                            elif 'Type 2' in conn_type: kw = 22.0
                            else: kw = 3.7

                        cursor.execute(
                            """INSERT INTO Charger 
                               (charger_id, connector_type, current_type, max_power_kw, status, station_id, policy_id) 
                               VALUES (%s, %s, %s, %s, 'AVAILABLE', %s, 'POL_DEFAULT')""",
                            (c_id, conn_type, curr_type, kw, s_id)
                        )
                        seen_chargers.add(c_id)
        
        conn.commit()
        return {"status": "OK"}
        
    except FileNotFoundError:
        conn.rollback() # Ακύρωση αλλαγών αν δεν βρεθεί το αρχείο
        return JSONResponse(status_code=500, content=create_error_log(Request, 500, "Initial JSON file not found"))
    except Exception as e:
        conn.rollback()
        return JSONResponse(status_code=500, content=create_error_log(Request, 500, str(e)))
    finally:
        conn.close()

# --- 3. /admin/addpoints (ΤΕΛΙΚΟ & ΛΕΙΤΟΥΡΓΙΚΟ) ---
@app.post(f"{API_PREFIX}/admin/addpoints")
async def add_points(file: UploadFile = File(...)):
    if file.content_type != 'text/csv' and not file.filename.endswith('.csv'):
        # Κάποιοι clients στέλνουν application/vnd.ms-excel, οπότε ελέγχουμε και κατάληξη
        raise HTTPException(status_code=400, detail="File must be a CSV")
    
    content = await file.read()
    try:
        decoded = content.decode('utf-8')
    except UnicodeDecodeError:
        # Fallback αν το αρχείο δεν είναι utf-8
        decoded = content.decode('latin-1')
        
    reader = csv.DictReader(io.StringIO(decoded))
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    count_chargers = 0
    stations_added = 0
    
    try:
        # Προετοιμασία λίστας για να ελέγχουμε duplicates στο Loop
        # (Ή απλά βασιζόμαστε στο 'INSERT IGNORE' ή έλεγχο SELECT)
        
        for row in reader:
            # 1. Καθαρισμός δεδομένων από το CSV
            # Χρησιμοποιούμε .get() με default τιμές για ασφάλεια
            sid = row.get('station_id', '').strip()
            cid = row.get('charger_id', '').strip()
            
            if not sid or not cid:
                continue # Προσπερνάμε κενές γραμμές
            
            name = row.get('name', 'Unknown Station')
            addr = row.get('address', 'Unknown Address')
            lat = float(row.get('latitude', 0))
            lon = float(row.get('longitude', 0)) # Προσοχή αν στο CSV είναι 'longitude'
            
            conn_type = row.get('connector_type', 'Unknown')
            try:
                kw = float(row.get('max_power_kw', 0))
            except ValueError:
                kw = 0.0
            
            # 2. Υπολογισμός AC/DC
            # Απλή λογική: Αν είναι CCS/CHAdeMO ή > 40kW είναι DC, αλλιώς AC
            if 'CCS' in conn_type or 'CHAdeMO' in conn_type or kw > 40:
                curr_type = 'DC'
            else:
                curr_type = 'AC'

            # 3. Εισαγωγή Σταθμού (Αν δεν υπάρχει)
            cursor.execute("SELECT station_id FROM Station WHERE station_id = %s", (sid,))
            if not cursor.fetchone():
                cursor.execute(
                    "INSERT INTO Station (station_id, name, address, latitude, longitude) VALUES (%s, %s, %s, %s, %s)",
                    (sid, name, addr, lat, lon)
                )
                stations_added += 1
            
            # 4. Εισαγωγή Φορτιστή
            # Χρησιμοποιούμε INSERT IGNORE ή ελέγχουμε αν υπάρχει για να μην σκάσει σε duplicates
            cursor.execute("SELECT charger_id FROM Charger WHERE charger_id = %s", (cid,))
            if not cursor.fetchone():
                cursor.execute(
                    """INSERT INTO Charger 
                       (charger_id, connector_type, current_type, max_power_kw, status, station_id, policy_id) 
                       VALUES (%s, %s, %s, %s, 'AVAILABLE', %s, 'POL_DEFAULT')""",
                    (cid, conn_type, curr_type, kw, sid)
                )
                count_chargers += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        # Επιστρέφουμε error log όπως ζητάει η εκφώνηση
        return JSONResponse(status_code=500, content=create_error_log(request, 500, f"CSV Import Error: {str(e)}"))
        
    conn.close()
    
    return {
        "status": "OK", 
        "chargers_added": count_chargers,
        "stations_created": stations_added
    }

# --- 4. /points (Λίστα σημείων φόρτισης - Section a) ---
@app.get(f"{API_PREFIX}/points")
async def get_points(request: Request, status: str = None, format: str = "json"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # Έλεγχος εγκυρότητας status (όπως ζητάει η εκφώνηση)
    if status:
        valid_statuses = ["available", "charging", "reserved", "outoforder", "offline"]
        if status.lower() not in valid_statuses:
            conn.close()
            return JSONResponse(status_code=401, content=create_error_log(request, 401, "Invalid status argument"))

    # --- ΤΟ ΔΙΟΡΘΩΜΕΝΟ QUERY ---
    # Ζητάμε τα υποχρεωτικά πεδία (providerName, pointid, lon, lat, status, cap)
    # ΑΛΛΑ ΚΑΙ τα έξτρα (station_name, address) για να τα δει το UI
    query = """
        SELECT 
            'WATTever' as providerName,
            c.charger_id as pointid,
            s.longitude as lon,
            s.latitude as lat,
            c.status,
            ROUND(c.max_power_kw) as cap,
            s.name as station_name,      -- ΕΞΤΡΑ ΠΕΔΙΟ ΓΙΑ ΤΟ UI
            s.address as station_address -- ΕΞΤΡΑ ΠΕΔΙΟ ΓΙΑ ΤΟ UI
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
    
    # Διαχείριση CSV format (αν το ζητήσει το CLI)
    if format == "csv":
        output = io.StringIO()
        if data:
            # Στο CSV για την εργασία ίσως πρέπει να κρύψεις τα έξτρα πεδία αν είναι αυστηροί.
            # Αλλά για το JSON (που παίρνει το React) τα αφήνουμε.
            writer = csv.DictWriter(output, fieldnames=data[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(data)
        return Response(content=output.getvalue(), media_type="text/csv")
        
    return data

# --- 5. /point/{id} (ΔΙΟΡΘΩΜΕΝΟ: Spec Compliant + UI Data) ---
@app.get(API_PREFIX + "/point/{point_id}")
async def get_point_details(request: Request, point_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # ΠΡΟΣΟΧΗ: Προσθέσαμε ξανά τα lat/lon που απαιτεί η εκφώνηση
    query = """
        SELECT 
            c.charger_id as pointid,
            s.latitude as lat,           -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            s.longitude as lon,         -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            c.status,                    -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            c.max_power_kw as cap,       -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            pp.fixed_price_kwh as kwhprice, -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            r.expiration_time as reservationendtime, -- ΥΠΟΧΡΕΩΤΙΚΟ (Spec)
            
            s.name as station_name,      -- Extra για το UI (Frontend)
            s.address as station_address -- Extra για το UI (Frontend)
        FROM Charger c
        JOIN Station s ON c.station_id = s.station_id
        JOIN PricingPolicy pp ON c.policy_id = pp.policy_id
        LEFT JOIN Reservation r ON c.charger_id = r.charger_id 
             AND r.status = 'ACTIVE' 
             AND r.expiration_time > NOW()
        WHERE c.charger_id = %s
    """
    cursor.execute(query, (point_id,))
    point = cursor.fetchone()
    conn.close()
    
    if not point:
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    # Η εκφώνηση απαιτεί string format για το timestamp
    if point["reservationendtime"]:
        point["reservationendtime"] = point["reservationendtime"].strftime("%Y-%m-%d %H:%M")
    
    # Μετατροπή Decimal σε float/string αν χρειάζεται (η JSONResponse το κάνει αυτόματα συνήθως, 
    # αλλά η εκφώνηση λέει lat/lon string. Αν η βάση τα έχει Decimal, ίσως χρειαστεί str())
    point['lat'] = str(point['lat'])
    point['lon'] = str(point['lon'])

    return point

# --- 6. /reserve/{id} ---
@app.post(API_PREFIX + "/reserve/{point_id}")
@app.post(API_PREFIX + "/reserve/{point_id}/{minutes}")
async def reserve_point(request: Request, point_id: str, minutes: int = 30):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Έλεγχος αν υπάρχει και είναι διαθέσιμο
    cursor.execute("SELECT status FROM Charger WHERE charger_id = %s", (point_id,))
    point = cursor.fetchone()
    
    if not point or point["status"] != "AVAILABLE":
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Cannot reserve (not available)"))
    
    # 2. Δημιουργία κράτησης
    actual_minutes = min(60, minutes)
    end_time = datetime.now() + timedelta(minutes=actual_minutes)
    
    # Ενημέρωση πίνακα Charger
    cursor.execute("UPDATE Charger SET status = 'RESERVED' WHERE charger_id = %s", (point_id,))
    
    # Εισαγωγή στον πίνακα Reservation (Χρειάζεται ένα user_id, βάζουμε τον test user 'USR_001')
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

# --- 7. /updpoint/{id} (ΤΕΛΙΚΟ & ΠΛΗΡΕΣ ΜΕ ΙΣΤΟΡΙΚΟ) ---
@app.post(API_PREFIX + "/updpoint/{point_id}")
async def update_point(request: Request, point_id: str, input_data: UpdatePointInput):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Βρίσκουμε τον φορτιστή και την τρέχουσα πολιτική του
    cursor.execute("""
        SELECT c.*, pp.fixed_price_kwh 
        FROM Charger c
        JOIN PricingPolicy pp ON c.policy_id = pp.policy_id
        WHERE c.charger_id = %s
    """, (point_id,))
    
    current_point = cursor.fetchone()
    
    if not current_point:
        conn.close()
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))

    # --- ΔΙΑΧΕΙΡΙΣΗ STATUS ---
    new_status = current_point['status'] # Default το παλιό
    
    if input_data.status is not None:
        # Έλεγχος αν δόθηκε έγκυρο status
        valid_statuses = ["available", "charging", "reserved", "outoforder", "offline"]
        if input_data.status.lower() not in valid_statuses:
            conn.close()
            return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid status"))
        
        new_status = input_data.status.upper() # Η βάση τα θέλει κεφαλαία συνήθως
        
        # Ενημέρωση μόνο αν ΠΡΑΓΜΑΤΙΚΑ άλλαξε η κατάσταση
        if new_status != current_point['status']:
            try:
                # Α. Καταγραφή στο Ιστορικό (StatusHistory)
                # Υποθέτω ότι ο πίνακας έχει στήλες: point_id, old_status, new_status, change_time
                # Το NOW() είναι συνάρτηση της SQL για την τρέχουσα ώρα
                cursor.execute("""
                    INSERT INTO StatusHistory (point_id, old_status, new_status, change_time)
                    VALUES (%s, %s, %s, NOW())
                """, (point_id, current_point['status'], new_status))
                
                # Β. Ενημέρωση του πίνακα Charger
                cursor.execute("UPDATE Charger SET status = %s WHERE charger_id = %s", (new_status, point_id))
            except mysql.connector.Error as err:
                conn.close()
                return JSONResponse(status_code=500, content=create_error_log(request, 500, f"History Error: {err}"))

    # --- ΔΙΑΧΕΙΡΙΣΗ ΤΙΜΗΣ (Η Έξυπνη Λογική) ---
    new_price = float(current_point['fixed_price_kwh']) # Default η παλιά
    
    if input_data.kwhprice is not None:
        requested_price = float(input_data.kwhprice)
        
        if requested_price != new_price:
            # Ψάχνουμε αν υπάρχει ΗΔΗ πολιτική με αυτή την τιμή
            cursor.execute("SELECT policy_id FROM PricingPolicy WHERE fixed_price_kwh = %s LIMIT 1", (requested_price,))
            existing_policy = cursor.fetchone()
            
            new_policy_id = ""
            
            if existing_policy:
                # Περίπτωση Α: Υπάρχει, την χρησιμοποιούμε
                new_policy_id = existing_policy['policy_id']
            else:
                # Περίπτωση Β: Δεν υπάρχει, φτιάχνουμε νέα
                # Δημιουργία μοναδικού ID, π.χ. 'POL_0_45'
                new_policy_id = f"POL_{requested_price:.2f}".replace('.', '_')
                
                try:
                    cursor.execute("""
                        INSERT INTO PricingPolicy (policy_id, policy_type, name, fixed_price_kwh, margin_kwh, session_fee)
                        VALUES (%s, 'Custom', %s, %s, 0.05, 1.00)
                    """, (new_policy_id, f"Custom Policy {requested_price}E", requested_price))
                except mysql.connector.Error:
                    # Αν χτυπήσει (π.χ. υπάρχει ήδη το ID), συνεχίζουμε
                    pass
            
            # Ενημερώνουμε τον φορτιστή με το νέο Policy ID
            cursor.execute("UPDATE Charger SET policy_id = %s WHERE charger_id = %s", (new_policy_id, point_id))
            new_price = requested_price

    conn.commit()
    conn.close()
        
    # Επιστροφή της νέας κατάστασης όπως ζητάει η εκφώνηση
    return {
        "pointid": point_id,
        "status": new_status.lower(), 
        "kwhprice": new_price
    }

# --- 8. /newsession (Έναρξη Φόρτισης) ---
@app.post(API_PREFIX + "/newsession")
async def new_session(request: Request, input_data: SessionInput):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Έλεγχος αν υπάρχει ο φορτιστής
    cursor.execute("SELECT charger_id FROM Charger WHERE charger_id = %s", (input_data.id,))
    if not cursor.fetchone():
        conn.close()
        return JSONResponse(status_code=404, content=create_error_log(request, 404, "Point not found"))
    
    # 2. Δημιουργία Session ID
    sess_id = f"SESS_{input_data.id}_{int(datetime.now().timestamp())}"
    
    # 3. Εισαγωγή στη Βάση
    # ΠΡΟΣΟΧΗ: Χρησιμοποιούμε τα νέα πεδία start_soc, end_soc, cost_per_kwh, vehicle_id
    try:
        cursor.execute("""
            INSERT INTO ChargingSession 
            (session_id, start_time, charging_end_time, total_kwh, cost_per_kwh, total_cost, 
             start_soc, end_soc, 
             user_id, vehicle_id, charger_id, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'USR_001', 'VEH_001', %s, 'FINISHED')
        """, (
            sess_id, 
            input_data.starttime, 
            input_data.endtime, 
            input_data.totalkwh, 
            input_data.kwhprice,  # Αυτό πάει στο cost_per_kwh
            input_data.amount,    # Αυτό πάει στο total_cost
            input_data.startsoc,
            input_data.endsoc,
            input_data.id
        ))
        
        # Ενημέρωση ότι ο φορτιστής είναι ξανά AVAILABLE
        cursor.execute("UPDATE Charger SET status = 'AVAILABLE' WHERE charger_id = %s", (input_data.id,))
        
        conn.commit()
    except mysql.connector.Error as err:
        conn.close()
        return JSONResponse(status_code=500, content=create_error_log(request, 500, f"DB Error: {err}"))

    conn.close()
    return {"status": "OK"}

## --- 9. /sessions (Αναζήτηση Ιστορικού) ---
@app.get(API_PREFIX + "/sessions/{point_id}/{date_from}/{date_to}")
async def get_sessions(point_id: str, date_from: str, date_to: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    # 1. Μετατροπή ημερομηνιών
    try:
        d_from = datetime.strptime(date_from, "%Y%m%d")
        d_to = datetime.strptime(date_to, "%Y%m%d") + timedelta(days=1)
    except ValueError:
        conn.close()
        return JSONResponse(status_code=400, content={"error": "Invalid date format. Use YYYYMMDD"})

    # 2. Το Query με μετονομασία (ALIAS) για να ταιριάζει με την εκφώνηση
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
        WHERE charger_id = %s 
        AND start_time >= %s AND start_time < %s
    """
    
    cursor.execute(query, (point_id, d_from, d_to))
    results = cursor.fetchall()
    
    # 3. Μετατροπή datetime σε string (τώρα τα κλειδιά είναι starttime/endtime)
    for r in results:
        if isinstance(r['starttime'], datetime):
            r['starttime'] = r['starttime'].strftime("%Y-%m-%d %H:%M:%S")
        if r['endtime'] and isinstance(r['endtime'], datetime):
            r['endtime'] = r['endtime'].strftime("%Y-%m-%d %H:%M:%S")
        # Αν είναι None (π.χ. η φόρτιση τρέχει ακόμα), βάζουμε κενό ή null
        elif r['endtime'] is None:
             r['endtime'] = ""

    conn.close()
    return results

# --- 11. /pointstatus (Μεταβολές κατάστασης σημείου - Section g) ---
@app.get(API_PREFIX + "/pointstatus/{point_id}/{date_from}/{date_to}")
async def get_point_status(request: Request, point_id: str, date_from: str, date_to: str, format: str = "json"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 1. Μετατροπή ημερομηνιών
    try:
        d_from = datetime.strptime(date_from, "%Y%m%d")
        d_to = datetime.strptime(date_to, "%Y%m%d") + timedelta(days=1) # +1 για να καλύψει όλη τη μέρα
    except ValueError:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Invalid date format. Use YYYYMMDD"))

    # 2. Query με ALIAS για να ταιριάζει με την εκφώνηση
    query = """
        SELECT 
            change_time AS timeref, 
            old_status AS old_state, 
            new_status AS new_state
        FROM StatusHistory
        WHERE point_id = %s 
        AND change_time >= %s AND change_time < %s
        ORDER BY change_time DESC
    """
    
    cursor.execute(query, (point_id, d_from, d_to))
    results = cursor.fetchall()
    conn.close()

    # 3. Format datetime objects σε string (YYYY-MM-DD hh:mm)
    for r in results:
        if isinstance(r['timeref'], datetime):
            r['timeref'] = r['timeref'].strftime("%Y-%m-%d %H:%M")

    # 4. Διαχείριση CSV format
    if format == "csv":
        output = io.StringIO()
        if results:
            writer = csv.DictWriter(output, fieldnames=results[0].keys(), delimiter=',')
            writer.writeheader()
            writer.writerows(results)
        return Response(content=output.getvalue(), media_type="text/csv")

    return results

# --- 12. ΕΝΑΡΞΗ ΦΟΡΤΙΣΗΣ (Start Charging) ---
@app.post(API_PREFIX + "/charge/start/{point_id}/{vehicle_id}")
async def start_charging_process(request: Request, point_id: str, vehicle_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 1. Έλεγχος: Είναι ο φορτιστής RESERVED ή AVAILABLE;
    cursor.execute("SELECT status, policy_id FROM Charger WHERE charger_id = %s", (point_id,))
    charger = cursor.fetchone()
    
    if not charger or charger['status'] not in ['AVAILABLE', 'RESERVED']:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "Charger not ready"))

    # 2. Αλλαγή Status σε CHARGING
    cursor.execute("UPDATE Charger SET status = 'CHARGING' WHERE charger_id = %s", (point_id,))
    
    # 3. Δημιουργία Session (IN_PROGRESS)
    # Βρίσκουμε την τιμή χρέωσης
    cursor.execute("SELECT fixed_price_kwh FROM PricingPolicy WHERE policy_id = %s", (charger['policy_id'],))
    policy = cursor.fetchone()
    price = policy['fixed_price_kwh']

    session_id = f"SESS_{point_id}_{int(datetime.now().timestamp())}"
    
    cursor.execute("""
        INSERT INTO ChargingSession 
        (session_id, start_time, cost_per_kwh, start_soc, status, user_id, charger_id, vehicle_id)
        VALUES (%s, NOW(), %s, 20, 'IN_PROGRESS', 'USR_001', %s, %s)
    """, (session_id, price, point_id, vehicle_id))
    
    # (Προαιρετικά: Ενημερώνουμε και το Reservation να γίνει COMPLETED αν υπήρχε)
    cursor.execute("UPDATE Reservation SET status = 'COMPLETED' WHERE charger_id = %s AND status = 'ACTIVE'", (point_id,))

    conn.commit()
    conn.close()
    
    return {"status": "started", "session_id": session_id}


# --- 13. ΤΕΡΜΑΤΙΣΜΟΣ ΦΟΡΤΙΣΗΣ (Stop Charging) ---
@app.post(API_PREFIX + "/charge/stop/{point_id}")
async def stop_charging_process(request: Request, point_id: str):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    # 1. Βρες το ενεργό Session
    cursor.execute("""
        SELECT * FROM ChargingSession 
        WHERE charger_id = %s AND status = 'IN_PROGRESS' 
        ORDER BY start_time DESC LIMIT 1
    """, (point_id,))
    session = cursor.fetchone()
    
    if not session:
        conn.close()
        return JSONResponse(status_code=400, content=create_error_log(request, 400, "No active session found"))

    # 2. Υπολογισμοί (Προσομοίωση)
    # Στην πραγματικότητα αυτά θα τα έδινε ο φορτιστής. Εδώ τα υπολογίζουμε βάσει χρόνου.
    start_time = session['start_time']
    end_time = datetime.now()
    duration_minutes = (end_time - start_time).total_seconds() / 60
    
    # Ας υποθέσουμε ότι φορτίζει με 22kW (0.36 kWh ανά λεπτό)
    kwh_consumed = round(duration_minutes * 0.36, 3) 
    if kwh_consumed < 0.1: kwh_consumed = 0.1 # Ελάχιστη χρέωση

    cost = round(kwh_consumed * float(session['cost_per_kwh']), 2)

    # 3. Update Session (FINISHED)
    cursor.execute("""
        UPDATE ChargingSession 
        SET charging_end_time = %s, session_end_time = %s, 
            total_kwh = %s, total_cost = %s, end_soc = 80, status = 'FINISHED'
        WHERE session_id = %s
    """, (end_time, end_time, kwh_consumed, cost, session['session_id']))

    # 4. Create Transaction
    trans_id = f"TRX_{session['session_id']}"
    cursor.execute("""
        INSERT INTO Transaction (transaction_id, amount, type, status, session_id)
        VALUES (%s, %s, 'Card', 'Success', %s)
    """, (trans_id, cost, session['session_id']))

    # 5. Ελευθέρωση Φορτιστή
    cursor.execute("UPDATE Charger SET status = 'AVAILABLE' WHERE charger_id = %s", (point_id,))

    conn.commit()
    conn.close()

    return {
        "status": "finished",
        "kwh": kwh_consumed,
        "cost": cost,
        "duration_min": round(duration_minutes, 1)
    }

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=create_error_log(request, exc.status_code, exc.detail))