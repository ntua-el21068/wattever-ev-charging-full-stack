import requests
import json
import os
import sys
import urllib3
from datetime import datetime

# Απενεργοποίηση warnings για self-signed certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

BASE_URL = "https://localhost:9876/api"
VERIFY_SSL = False

# Χρώματα
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"

def log(status, msg):
    color = GREEN if status == "PASS" else RED
    print(f"{color}[{status}] {msg}{RESET}")

def run_full_test():
    print(f"🚀 ΕΝΑΡΞΗ ΠΛΗΡΟΥΣ ΕΛΕΓΧΟΥ (ΒΑΣΕΙ ΠΡΟΔΙΑΓΡΑΦΩΝ)\n")

    # --- 1. HEALTHCHECK ---
    try:
        res = requests.get(f"{BASE_URL}/admin/healthcheck", verify=VERIFY_SSL)
        if res.status_code == 200 and res.json().get("status") == "OK":
            log("PASS", "Healthcheck: OK")
        else:
            log("FAIL", f"Healthcheck failed: {res.text}")
    except Exception as e:
        log("FAIL", f"Server not reachable: {e}")
        return

    # --- 2. RESET POINTS ---
    # Αρχικοποίηση βάσης για να έχουμε καθαρά δεδομένα
    res = requests.post(f"{BASE_URL}/admin/resetpoints", verify=VERIFY_SSL)
    if res.status_code == 200:
        log("PASS", "Reset Points: OK")
    else:
        log("FAIL", f"Reset Points failed: {res.status_code}")

    # --- 3. ADD POINTS (Multipart CSV) ---
    # Δημιουργία προσωρινού CSV
    csv_content = "station_id,station_name,address,latitude,longitude,charger_id,connector_type,max_power_kw\n"
    csv_content += "ST_AUTO,AutoStation,Address,38.0,23.0,CH_AUTO_01,Type 2,22\n"
    with open("temp_chargers.csv", "w") as f:
        f.write(csv_content)
    
    with open("temp_chargers.csv", "rb") as f:
        files = {'file': ('temp_chargers.csv', f, 'text/csv')}
        res = requests.post(f"{BASE_URL}/admin/addpoints", files=files, verify=VERIFY_SSL)
        if res.status_code == 200:
            log("PASS", "Add Points (CSV Upload): OK")
        else:
            log("FAIL", f"Add Points failed: {res.text}")
    os.remove("temp_chargers.csv")

    # --- 4. LIST POINTS (JSON & CSV) ---
    # JSON Check
    res = requests.get(f"{BASE_URL}/points", verify=VERIFY_SSL)
    points = res.json()
    if isinstance(points, list) and len(points) > 0:
        log("PASS", f"Get Points (JSON): Found {len(points)} chargers")
        target_id = points[0]['pointid'] # Κρατάμε ένα ID για τα επόμενα (π.χ. '1')
    else:
        log("FAIL", "Get Points (JSON) failed or empty")
        return

    # CSV Check (delimiter verification)
    res = requests.get(f"{BASE_URL}/points?format=csv", verify=VERIFY_SSL)
    if "providerName,pointid" in res.text or "providerName, pointid" in res.text:
        log("PASS", "Get Points (CSV): Format OK")
    else:
        log("FAIL", f"Get Points (CSV) invalid format: {res.text[:50]}...")

    # --- 5. POINT DETAILS ---
    res = requests.get(f"{BASE_URL}/point/{target_id}", verify=VERIFY_SSL)
    if res.status_code == 200 and "kwhprice" in res.json():
        log("PASS", f"Get Point Details ({target_id}): OK")
    else:
        log("FAIL", f"Get Point Details failed: {res.status_code}")

    # --- 6. UPDATE POINT (POST) ---
    # Αλλαγή τιμής και status
    upd_data = {"status": "malfunction", "kwhprice": 0.99}
    res = requests.post(f"{BASE_URL}/updpoint/{target_id}", json=upd_data, verify=VERIFY_SSL)
    if res.status_code == 200 and res.json().get("status") == "malfunction":
        log("PASS", "Update Point (Status & Price): OK")
    else:
        log("FAIL", f"Update Point failed: {res.text}")
    
    # Επαναφορά σε available για να κάνουμε reserve
    requests.post(f"{BASE_URL}/updpoint/{target_id}", json={"status": "available"}, verify=VERIFY_SSL)

    # --- 7. RESERVE POINT ---
    res = requests.post(f"{BASE_URL}/reserve/{target_id}/30", verify=VERIFY_SSL)
    if res.status_code == 200 and res.json().get("status") == "reserved":
        log("PASS", "Reserve Point: OK")
    else:
        log("FAIL", f"Reserve Point failed: {res.text}")

    # --- 8. NEW SESSION ---
    # Πρέπει να ελευθερώσουμε τον φορτιστή πρώτα ή να χρησιμοποιήσουμε έναν άλλον
    # Ας υποθέσουμε ότι η 'newsession' ελέγχει αν υπάρχει το point.
    session_data = {
        "id": str(target_id),
        "starttime": "2026-01-01 10:00",
        "endtime": "2026-01-01 11:00",
        "startsoc": 20,
        "endsoc": 80,
        "totalkwh": 50.5,
        "kwhprice": 0.50,
        "amount": 25.25
    }
    res = requests.post(f"{BASE_URL}/newsession", json=session_data, verify=VERIFY_SSL)
    if res.status_code == 200:
        log("PASS", "New Session: Recorded OK")
    else:
        log("FAIL", f"New Session failed: {res.text}")

    # --- 9. SESSIONS HISTORY ---
    # Ψάχνουμε τις συνεδρίες του 2026 που μόλις φτιάξαμε
    res = requests.get(f"{BASE_URL}/sessions/{target_id}/20260101/20260102", verify=VERIFY_SSL)
    data = res.json()
    if isinstance(data, list) and len(data) > 0:
         log("PASS", "Sessions History (JSON): OK (Found recorded session)")
    else:
         log("FAIL", f"Sessions History failed. Got: {data}")

    # --- 10. POINT STATUS HISTORY ---
    # Ελέγχουμε αν καταγράφηκαν οι αλλαγές που κάναμε στο βήμα 6 και 7
    # Χρησιμοποιούμε σημερινή ημερομηνία
    today = datetime.now().strftime("%Y%m%d")
    res = requests.get(f"{BASE_URL}/pointstatus/{target_id}/{today}/{today}", verify=VERIFY_SSL)
    data = res.json()
    if isinstance(data, list) and len(data) > 0:
        log("PASS", "Point Status History: OK (Found status changes)")
    else:
        log("FAIL", f"Point Status History failed or empty. Got: {data}")

    print(f"\n✅ ΟΛΟΚΛΗΡΩΣΗ ΕΛΕΓΧΟΥ")

if __name__ == "__main__":
    run_full_test()