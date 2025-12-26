#!/usr/bin/env python3
"""
WATTever CLI
Ομάδα 51 - Τεχνολογία Λογισμικού 2025
"""

import argparse
import sys
import json
import requests
from datetime import datetime  


def get_mock_data():
    """Επιστρέφει mock δεδομένα σύμφωνα με τις προδιαγραφές"""
    return {
        "status": "OK",
        "dbconnection": "mysql://mock:mock@localhost:3306/mockdb",
        "n_charge_points": 150,
        "n_charge_points_online": 145,
        "n_charge_points_offline": 5
    }

def get_mock_points(status=None):
    """Επιστρέφει mock δεδομένα για φορτιστές σύμφωνα με προδιαγραφές Part 2 σελ. 3"""
    # Βασικά mock data από προδιαγραφές
    all_points = [
        {
            "providerName": "bestPowerGR",
            "pointid": 1,
            "lon": "23.7345",
            "lat": "37.9838",
            "status": "available",
            "cap": 50
        },
        {
            "providerName": "bestPowerGR",
            "pointid": 2,
            "lon": "23.7275",
            "lat": "37.9755",
            "status": "charging",
            "cap": 22
        },
        {
            "providerName": "bestPowerGR", 
            "pointid": 3,
            "lon": "23.7201",
            "lat": "37.9702",
            "status": "reserved",
            "cap": 11
        },
        {
            "providerName": "bestPowerGR",
            "pointid": 4,
            "lon": "23.7300",
            "lat": "37.9800",
            "status": "available",
            "cap": 50
        },
        {
            "providerName": "bestPowerGR",
            "pointid": 5,
            "lon": "23.7250",
            "lat": "37.9775",
            "status": "malfunction",
            "cap": 22
        }
    ]
    
    # Φίλτρο ανά status αν δοθεί
    if status:
        return [point for point in all_points if point["status"] == status]
    return all_points

def get_mock_point(point_id):
    """Επιστρέφει mock δεδομένα για ένα συγκεκριμένο φορτιστή"""
    # Mock database με διαφορετικούς φορτιστές
    mock_points_db = {
        "1": {
            "pointid": "1",
            "lon": "23.7345",
            "lat": "37.9838",
            "status": "available",
            "cap": 50,
            "reservationendtime": "2025-11-10 18:30",
            "kwhprice": 0.59
        },
        "2": {
            "pointid": "2",
            "lon": "23.7275",
            "lat": "37.9755",
            "status": "charging",
            "cap": 22,
            "reservationendtime": "2025-11-10 19:00",
            "kwhprice": 0.55
        },
        "3": {
            "pointid": "3",
            "lon": "23.7201",
            "lat": "37.9702",
            "status": "reserved",
            "cap": 11,
            "reservationendtime": "2025-11-10 20:00",
            "kwhprice": 0.60
        },
        "123": {
            "pointid": "123",
            "lon": "23.8000",
            "lat": "38.0000",
            "status": "available",
            "cap": 100,
            "reservationendtime": "2025-11-10 15:30",
            "kwhprice": 0.65
        }
    }
    
    # Επιστροφή του φορτιστή ή μήνυμα λάθους
    return mock_points_db.get(str(point_id), {
        "error": f"Φορτιστής με ID {point_id} δεν βρέθηκε"
    })

def get_mock_point_for_update(point_id):
    """Επιστρέφει mock δεδομένα για ενημέρωση φορτιστή"""
    # Βασικά δεδομένα για διάφορους φορτιστές
    mock_points = {
        "1": {"status": "available", "kwhprice": 0.55},
        "2": {"status": "charging", "kwhprice": 0.60},
        "3": {"status": "reserved", "kwhprice": 0.58},
        "123": {"status": "available", "kwhprice": 0.65}
    }
    
    # Επιστροφή δεδομένων για τον συγκεκριμένο φορτιστή ή default
    return mock_points.get(str(point_id), {"status": "available", "kwhprice": 0.50})


def get_mock_pointstatus(point_id, date_from, date_to, format_type='json'):
    """Επιστρέφει mock δεδομένα για ιστορικό κατάστασης"""
    mock_data = [
        {
            "timeref": "2025-11-02 08:55",
            "old_state": "available",
            "new_state": "charging"
        },
        {
            "timeref": "2025-11-02 10:25", 
            "old_state": "charging",
            "new_state": "available"
        },
        {
            "timeref": "2025-11-05 15:40",
            "old_state": "available", 
            "new_state": "reserved"
        },
        {
            "timeref": "2025-11-05 15:45",
            "old_state": "reserved",
            "new_state": "charging"
        }
    ]
    
    if format_type == 'csv':
        csv_output = "timeref__old_state__new_state\n"
        for item in mock_data:
            csv_output += f"{item['timeref']}__{item['old_state']}__{item['new_state']}\n"
        return csv_output.strip()
    else:
        return mock_data
    

def get_mock_reservation_success(point_id, minutes=None):
    """Επιστρέφει επιτυχημένη mock δέσμευση"""
    from datetime import datetime, timedelta
    
    # Υπολογισμός λήξης δέσμευσης
    reservation_minutes = min(minutes if minutes else 30, 60)  # Μέγιστο 60 λεπτά
    end_time = datetime.now() + timedelta(minutes=reservation_minutes)
    
    return {
        "pointid": str(point_id),
        "status": "reserved",
        "reservationendtime": end_time.strftime("%Y-%m-%d %H:%M"),
        "mock_note": "Mock reservation - API not available"
    }


def get_mock_reservation_failed(point_id, minutes=None):
    """Επιστρέφει αποτυχημένη mock δέσμευση"""
    return {
        "pointid": str(point_id),
        "status": "available",  # Παραμένει available
        "reservationendtime": "1970-01-01 00:00",  # Unix epoch για αποτυχία
        "error": "Charger not available for reservation",
        "mock_note": "Mock failed reservation"
    }


def get_mock_sessions(point_id, date_from, date_to, format_type='json'):
    """Επιστρέφει mock δεδομένα για ιστορικό φορτίσεων"""
    mock_data = [
        {
            "starttime": "2025-11-07 09:10",
            "endtime": "2025-11-07 10:20", 
            "startsoc": 20,
            "endsoc": 70,
            "totalkwh": 18.4,
            "kwhprice": 0.29,
            "amount": 5.34
        },
        {
            "starttime": "2025-11-05 15:45",
            "endtime": "2025-11-05 17:10",
            "startsoc": 35, 
            "endsoc": 90,
            "totalkwh": 26.7,
            "kwhprice": 0.29,
            "amount": 7.74
        },
        {
            "starttime": "2025-11-05 08:30",
            "endtime": "2025-11-05 09:50",
            "startsoc": 10,
            "endsoc": 80,
            "totalkwh": 31.2,
            "kwhprice": 0.29, 
            "amount": 9.05
        }
    ]
    
    if format_type == 'csv':
        csv_output = "starttime__endtime__startsoc__endsoc__totalkwh__kwhprice__amount\n"
        for session in mock_data:
            csv_output += f"{session['starttime']}__{session['endtime']}__"
            csv_output += f"{session['startsoc']}__{session['endsoc']}__"
            csv_output += f"{session['totalkwh']}__{session['kwhprice']}__{session['amount']}\n"
        return csv_output.strip()
    else:
        return mock_data





def get_mock_newsession_success(session_data):
    """Επιστρέφει επιτυχημένη mock καταγραφή φόρτισης"""
    return {
        "status": "success",
        "message": "Mock: Charging session recorded",
        "session_id": f"session_{int(datetime.now().timestamp())}",
        "data": session_data,
        "mock_note": "API not available - simulated response"
    }


def get_mock_newsession_error(session_data):
    """Επιστρέφει αποτυχημένη mock καταγραφή"""
    return {
        "status": "error",
        "message": "Failed to record charging session",
        "error_code": "SESSION_RECORD_FAILED",
        "data": session_data
    }

def healthcheck_command():
    """Εκτελεί την εντολή healthcheck"""
    print("🔍 Εκτέλεση healthcheck...")
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        response = requests.get("https://localhost:9876/api/admin/healthcheck", timeout=3)
        
        if response.status_code == 200:
            # Βρήκε το API - χρησιμοποιούμε πραγματικά δεδομένα
            data = response.json()
            print("✅ Το API βρέθηκε και απάντησε!")
        else:
            # Το API υπάρχει αλλά έδωσε error
            print(f"⚠️ Το API απάντησε με σφάλμα: HTTP {response.status_code}")
            print("🔄 Πτώση σε mock δεδομένα...")
            data = get_mock_data()
            
    except requests.exceptions.ConnectionError:
        # ΔΕΝ βρέθηκε το API
        print("❌ API NOT READY - Δεν μπορώ να συνδεθώ στο API")
        print("   Το API δεν τρέχει στο localhost:9876")
        print("   Χρήση mock δεδομένων...")
        data = get_mock_data()
        
    except requests.exceptions.Timeout:
        print("⏰ Timeout - Το API δεν απάντησε εγκαίρως")
        print("🔄 Χρήση mock δεδομένα...")
        data = get_mock_data()
    
    except Exception as e:
        print(f"⚠️ Άγνωστο σφάλμα: {e}")
        print("🔄 Χρήση mock δεδομένα...")
        data = get_mock_data()
    
    # Εμφάνιση αποτελεσμάτων (είτε από API είτε από mock)
    print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
    print(json.dumps(data, indent=2, ensure_ascii=False))
    
    return data

def points_command(status=None, format_type='json'):
    """Εκτελεί την εντολή points για λίστα φορτιστών"""
    print(f"📋 Λίστα φορτιστών" + (f" (status: {status})" if status else ""))
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        
        # Κατασκευή URL με παραμέτρους
        url = "https://localhost:9876/api/points"
        params = {}
        if status:
            params['status'] = status
        if format_type:
            params['format'] = format_type
        
        response = requests.get(url, params=params, timeout=3)
        
        if response.status_code == 200:
            # Βρήκε το API
            print("✅ Το API βρέθηκε και απάντησε!")
            
            if format_type == 'csv':
                return response.text  # CSV text
            else:
                return response.json()  # JSON data
                
        else:
            # Το API υπάρχει αλλά έδωσε error
            print(f"⚠️ Το API απάντησε με σφάλμα: HTTP {response.status_code}")
            print("🔄 Πτώση σε mock δεδομένα...")
            return get_mock_points(status)
            
    except requests.exceptions.ConnectionError:
        # ΔΕΝ βρέθηκε το API
        print("❌ API NOT READY - Δεν μπορώ να συνδεθώ στο API")
        print("   Χρήση mock δεδομένων...")
        return get_mock_points(status)
        
    except requests.exceptions.Timeout:
        print("⏰ Timeout - Το API δεν απάντησε εγκαίρως")
        print("🔄 Χρήση mock δεδομένων...")
        return get_mock_points(status)
    
    except Exception as e:
        print(f"⚠️ Άγνωστο σφάλμα: {e}")
        print("🔄 Χρήση mock δεδομένων...")
        return get_mock_points(status)
    

def point_command(point_id):
    """Εκτελεί την εντολή point για ένα συγκεκριμένο φορτιστή"""
    print(f"🔎 Πληροφορίες για φορτιστή ID: {point_id}")
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        
        # Κατασκευή URL σύμφωνα με προδιαγραφές: /point/:id
        url = f"https://localhost:9876/api/point/{point_id}"
        
        response = requests.get(url, timeout=3)
        
        if response.status_code == 200:
            # Βρήκε το API
            print("✅ Το API βρέθηκε και απάντησε!")
            return response.json()
                
        elif response.status_code == 404:
            # Ο φορτιστής δεν βρέθηκε στο API
            print(f"❌ Ο φορτιστής {point_id} δεν βρέθηκε στο API")
            return get_mock_point(point_id)
            
        else:
            # Άλλο σφάλμα από το API
            print(f"⚠️ Το API απάντησε με σφάλμα: HTTP {response.status_code}")
            print("🔄 Πτώση σε mock δεδομένα...")
            return get_mock_point(point_id)
            
    except requests.exceptions.ConnectionError:
        # ΔΕΝ βρέθηκε το API
        print("❌ API NOT READY - Δεν μπορώ να συνδεθώ στο API")
        print("   Χρήση mock δεδομένων...")
        return get_mock_point(point_id)
        
    except requests.exceptions.Timeout:
        print("⏰ Timeout - Το API δεν απάντησε εγκαίρως")
        print("🔄 Χρήση mock δεδομένων...")
        return get_mock_point(point_id)
    
    except Exception as e:
        print(f"⚠️ Άγνωστο σφάλμα: {e}")
        print("🔄 Χρήση mock δεδομένων...")
        return get_mock_point(point_id)


def addpoints_command(csv_file_path):
    """Εκτελεί την εντολή addpoints για προσθήκη νέων φορτιστών από CSV"""
    print(f"📁 Προσθήκη φορτιστών από αρχείο: {csv_file_path}")
    
    # Έλεγχος αν το αρχείο υπάρχει
    import os
    if not os.path.exists(csv_file_path):
        print(f"❌ Το αρχείο '{csv_file_path}' δεν βρέθηκε")
        return {"error": f"File not found: {csv_file_path}"}
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        
        # Κατασκευή URL
        url = "https://localhost:9876/api/admin/addpoints"
        
        # Άνοιγμα και αποστολή του CSV αρχείου
        with open(csv_file_path, 'rb') as csv_file:
            files = {'file': (os.path.basename(csv_file_path), csv_file, 'text/csv')}
            response = requests.post(url, files=files, timeout=10)
        
        if response.status_code == 200:
            print("✅ Το API δέχτηκε το αρχείο CSV!")
            return {"status": "success", "message": "File uploaded successfully"}
        else:
            # Σφάλμα από το API
            print(f"⚠️ Το API απάντησε με σφάλμα: HTTP {response.status_code}")
            try:
                error_data = response.json()
                return {"status": "error", "message": error_data}
            except:
                return {"status": "error", "message": response.text}
            
    except requests.exceptions.ConnectionError:
        # ΔΕΝ βρέθηκε το API - δημιουργούμε mock success
        print("❌ API NOT READY - Δεν μπορώ να συνδεθώ στο API")
        print("   Mock: Το αρχείο CSV θα ανεβαινόταν εάν ήταν διαθέσιμο το API")
        
        # Δημιουργία mock success response
        return {
            "status": "success",
            "message": "Mock upload - API not available",
            "mock_data": {
                "filename": os.path.basename(csv_file_path),
                "file_size": os.path.getsize(csv_file_path),
                "upload_timestamp": "2025-11-10 12:00:00"
            }
        }
        
    except requests.exceptions.Timeout:
        print("⏰ Timeout - Το API δεν απάντησε εγκαίρως")
        return {"status": "error", "message": "API timeout"}
    
    except Exception as e:
        print(f"⚠️ Άγνωστο σφάλμα: {e}")
        return {"status": "error", "message": str(e)}
    

def updpoint_command(point_id, status=None, price=None):
    """Εκτελεί την εντολή updpoint για ενημέρωση φορτιστή"""
    print(f"✏️ Ενημέρωση φορτιστή ID: {point_id}")
    
    # Έλεγχος ότι δόθηκε τουλάχιστον μία παράμετρος
    if status is None and price is None:
        error_response = {
            "call": "POST /api/updpoint/:id",
            "timeref": "2025-11-10 12:00:00",
            "originator": "CLI",
            "return_code": 400,
            "error": "At least one of --status or --price must be provided",
            "debuginfo": "No update parameters provided"
        }
        print("❌ Πρέπει να δοθεί τουλάχιστον ένα από: --status ή --price")
        return error_response
    
    # Προετοιμασία δεδομένων για το API
    update_data = {}
    if status is not None:
        update_data["status"] = status
        print(f"   Νέα κατάσταση: {status}")
    if price is not None:
        update_data["kwhprice"] = float(price)
        print(f"   Νέα τιμή/kWh: €{price}")
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        
        # Κατασκευή URL
        url = f"https://localhost:9876/api/updpoint/{point_id}"
        
        # Αποστολή POST request με JSON body
        response = requests.post(url, json=update_data, timeout=5)
        
        if response.status_code == 200:
            print("✅ Το API επεξεργάστηκε την ενημέρωση!")
            return response.json()
        else:
            # Σφάλμα από το API
            print(f"❌ Σφάλμα API: HTTP {response.status_code}")
            try:
                return response.json()
            except:
                return {
                    "call": url,
                    "timeref": "2025-11-10 12:00:00",
                    "originator": "CLI",
                    "return_code": response.status_code,
                    "error": "Update failed",
                    "debuginfo": response.text[:100] if response.text else "No details"
                }
            
    except requests.exceptions.ConnectionError:
        # ΔΕΝ βρέθηκε το API - MOCK RESPONSE
        print("❌ API NOT READY - Χρήση mock δεδομένων...")
        
        # Δημιουργία mock response
        return {
            "pointid": str(point_id),
            "status": status if status else "unchanged",
            "kwhprice": float(price) if price is not None else 0.50,
            "mock_note": "API not available - this is a simulated response"
        }
        
    except Exception as e:
        print(f"⚠️ Σφάλμα: {e}")
        return {
            "call": "POST /api/updpoint/:id",
            "timeref": "2025-11-10 12:00:00",
            "originator": "CLI",
            "return_code": 500,
            "error": "Internal error during update",
            "debuginfo": str(e)
        }


def resetpoints_command():
    """Εκτελεί την εντολή resetpoints"""
    print("🔄 Επαναφορά δεδομένων φορτιστών...")
    
    try:
        print("🌐 Προσπάθεια σύνδεσης με API...")
        response = requests.post("https://localhost:9876/api/admin/resetpoints", timeout=5)
        
        if response.status_code == 200:
            print("✅ Επιτυχής επαναφορά!")
            try:
                return response.json()
            except:
                return {"status": "success", "message": "Database reset completed"}
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return {"error": f"Reset failed: {response.status_code}"}
            
    except requests.exceptions.ConnectionError:
        print("❌ API NOT READY - Mock response")
        return {
            "status": "success",
            "message": "Mock: Database would be reset from default JSON file",
            "mock_note": "API not available"
        }
    except Exception as e:
        print(f"⚠️ Error: {e}")
        return {"error": str(e)}
    

def pointstatus_command(point_id, date_from, date_to, format_type='json'):
    """Εκτελεί την εντολή pointstatus για ιστορικό αλλαγών κατάστασης"""
    print(f"📈 Ιστορικό κατάστασης φορτιστή ID: {point_id}")
    print(f"   Από: {date_from} έως: {date_to}")
    
    try:
        print("🌐 Προσπάθεια σύνδεσης με API...")
        url = f"https://localhost:9876/api/pointstatus/{point_id}/{date_from}/{date_to}"
        params = {}
        if format_type:
            params['format'] = format_type
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            print("✅ Το API βρέθηκε!")
            if format_type == 'csv':
                return response.text
            else:
                return response.json()
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return get_mock_pointstatus(point_id, date_from, date_to)
            
    except requests.exceptions.ConnectionError:
        print("❌ API NOT READY - Χρήση mock δεδομένων...")
        return get_mock_pointstatus(point_id, date_from, date_to, format_type)
    except Exception as e:
        print(f"⚠️ Error: {e}")
        return {"error": str(e)}
    


def reserve_command(point_id, minutes=None):
    """Εκτελεί την εντολή reserve για δέσμευση φορτιστή"""
    print(f"🔒 Δέσμευση φορτιστή ID: {point_id}")
    if minutes:
        print(f"   Διάρκεια: {minutes} λεπτά")
    else:
        print(f"   Διάρκεια: 30 λεπτά (default)")
    
    # Προσπάθεια σύνδεσης με το πραγματικό API
    try:
        print("🌐 Προσπάθεια σύνδεσης με το API...")
        
        # Κατασκευή URL σύμφωνα με προδιαγραφές
        if minutes:
            url = f"https://localhost:9876/api/reserve/{point_id}/{minutes}"
        else:
            url = f"https://localhost:9876/api/reserve/{point_id}"
        
        response = requests.post(url, timeout=5)
        
        if response.status_code == 200:
            print("✅ Επιτυχής δέσμευση!")
            return response.json()
        elif response.status_code == 400:
            print("❌ Ο φορτιστής δεν είναι διαθέσιμος για δέσμευση")
            return get_mock_reservation_failed(point_id, minutes)
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return get_mock_reservation_failed(point_id, minutes)
            
    except requests.exceptions.ConnectionError:
        print("❌ API NOT READY - Χρήση mock δεδομένων...")
        return get_mock_reservation_success(point_id, minutes)
    except Exception as e:
        print(f"⚠️ Error: {e}")
        return {"error": str(e)}
    

def sessions_command(point_id, date_from, date_to, format_type='json'):
    """Εκτελεί την εντολή sessions για ιστορικό φορτίσεων"""
    print(f"📊 Ιστορικό φορτίσεων φορτιστή ID: {point_id}")
    print(f"   Από: {date_from} έως: {date_to}")
    
    try:
        print("🌐 Προσπάθεια σύνδεσης με API...")
        url = f"https://localhost:9876/api/sessions/{point_id}/{date_from}/{date_to}"
        params = {}
        if format_type:
            params['format'] = format_type
        
        response = requests.get(url, params=params, timeout=5)
        
        if response.status_code == 200:
            print("✅ Το API βρέθηκε!")
            if format_type == 'csv':
                return response.text
            else:
                return response.json()
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return get_mock_sessions(point_id, date_from, date_to, format_type)
            
    except requests.exceptions.ConnectionError:
        print("❌ API NOT READY - Χρήση mock δεδομένων...")
        return get_mock_sessions(point_id, date_from, date_to, format_type)
    except Exception as e:
        print(f"⚠️ Error: {e}")
        return {"error": str(e)}



def newsession_command(point_id, starttime, endtime, startsoc, endsoc, 
                       totalkwh, kwhprice, amount):
    """Εκτελεί την εντολή newsession για καταγραφή νέας φόρτισης"""
    print(f"⚡ Καταγραφή νέας φόρτισης")
    print(f"   Φορτιστής: {point_id}")
    print(f"   Από: {starttime} έως: {endtime}")
    print(f"   SOC: {startsoc}% → {endsoc}%")
    print(f"   Ενέργεια: {totalkwh} kWh")
    print(f"   Τιμή: €{kwhprice}/kWh")
    print(f"   Σύνολο: €{amount}")
    
    try:
        print("🌐 Προσπάθεια σύνδεσης με API...")
        
        # Προετοιμασία δεδομένων
        session_data = {
            "id": str(point_id),
            "starttime": starttime,
            "endtime": endtime,
            "startsoc": int(startsoc),
            "endsoc": int(endsoc),
            "totalkwh": float(totalkwh),
            "kwhprice": float(kwhprice),
            "amount": float(amount)
        }
        
        # Αποστολή στο API
        url = "https://localhost:9876/api/newsession"
        response = requests.post(url, json=session_data, timeout=5)
        
        if response.status_code == 200:
            print("✅ Φόρτιση καταγράφηκε επιτυχώς!")
            return {"status": "success", "message": "Charging session recorded"}
        else:
            print(f"❌ API error: HTTP {response.status_code}")
            return get_mock_newsession_error(session_data)
            
    except requests.exceptions.ConnectionError:
        print("❌ API NOT READY - Χρήση mock δεδομένων...")
        return get_mock_newsession_success(session_data)
    except Exception as e:
        print(f"⚠️ Error: {e}")
        return {"error": str(e)}

def main():
    parser = argparse.ArgumentParser(
        prog='se2551',  
        description='CLI για διαχείριση φορτιστών ηλεκτρικών οχημάτων'
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Διαθέσιμες εντολές')
    
    health_parser = subparsers.add_parser('healthcheck', 
                                         help='Έλεγχος κατάστασης συστήματος')
    points_parser = subparsers.add_parser('points', 
                                     help='Εμφάνιση λίστας φορτιστών')

# Προσθήκη παραμέτρων για την εντολή points
    points_parser.add_argument('--status', 
                          choices=['available', 'charging', 'reserved', 'malfunction', 'offline'],
                          help='Φίλτρο κατάστασης φορτιστών')

    points_parser.add_argument('--format',
                          choices=['json', 'csv'],
                          default='json',
                          help='Μορφή εξόδου (default: json)')
    
    point_parser = subparsers.add_parser('point', 
                                        help='Πληροφορίες για συγκεκριμένο φορτιστή')
    point_parser.add_argument('--id',
                            required=True,
                            type=str,
                            help='ID του φορτιστή (required)')
    point_parser.add_argument('--format',
                            choices=['json', 'csv'],
                            default='json',
                            help='Μορφή εξόδου (default: json)')
    
        # 4. Addpoints command (προσθήκη φορτιστών από CSV)
    addpoints_parser = subparsers.add_parser('addpoints', 
                                           help='Προσθήκη νέων φορτιστών από CSV αρχείο')
    
    # Υποχρεωτική παράμετρος --source
    addpoints_parser.add_argument('--source',
                                required=True,
                                type=str,
                                help='Μονοπάτι προς το CSV αρχείο (required)')
    
    # Προαιρετική παράμετρος για δημιουργία sample CSV
    addpoints_parser.add_argument('--create-sample',
                                action='store_true',
                                help='Δημιουργεί ένα δείγμα CSV αρχείο για testing')
    

        # 5. Updpoint command (ενημέρωση φορτιστή)
    updpoint_parser = subparsers.add_parser('updpoint', 
                                          help='Ενημέρωση κατάστασης ή τιμής φορτιστή')
    
    # Υποχρεωτική παράμετρος --id
    updpoint_parser.add_argument('--id',
                               required=True,
                               type=str,
                               help='ID του φορτιστή (required)')
    
    # Προαιρετικές παράμετροι (τουλάχιστον μία πρέπει να δοθεί)
    updpoint_parser.add_argument('--status',
                               choices=['available', 'charging', 'reserved', 'malfunction', 'offline'],
                               help='Νέα κατάσταση φορτιστή')
    
    updpoint_parser.add_argument('--price',
                               type=float,
                               help='Νέα τιμή ανά kWh (π.χ. 0.40)')
    
        # 6. Resetpoints command
    resetpoints_parser = subparsers.add_parser('resetpoints', 
                                             help='Επαναφορά δεδομένων από προκαθορισμένο JSON αρχείο')
    

        # 7. Pointstatus command
    pointstatus_parser = subparsers.add_parser('pointstatus', 
                                             help='Ιστορικό αλλαγών κατάστασης φορτιστή')
    pointstatus_parser.add_argument('--id', required=True, help='ID του φορτιστή')
    pointstatus_parser.add_argument('--from', required=True, dest='date_from',
                                  help='Αρχική ημερομηνία (YYYYMMDD)')
    pointstatus_parser.add_argument('--to', required=True, dest='date_to',
                                  help='Τελική ημερομηνία (YYYYMMDD)')
    pointstatus_parser.add_argument('--format', choices=['json', 'csv'], default='json')

    reserve_parser = subparsers.add_parser('reserve', 
                                         help='Δέσμευση φορτιστή για συγκεκριμένο χρόνο')
    reserve_parser.add_argument('--id', required=True, help='ID του φορτιστή')
    reserve_parser.add_argument('--minutes', type=int, 
                              help='Διάρκεια δέσμευσης σε λεπτά (max 60, default: 30)')
    

    sessions_parser = subparsers.add_parser('sessions', 
                                          help='Ιστορικό φορτίσεων φορτιστή')
    sessions_parser.add_argument('--id', required=True, help='ID του φορτιστή')
    sessions_parser.add_argument('--from', required=True, dest='date_from',
                               help='Αρχική ημερομηνία (YYYYMMDD)')
    sessions_parser.add_argument('--to', required=True, dest='date_to',
                               help='Τελική ημερομηνία (YYYYMMDD)')
    sessions_parser.add_argument('--format', choices=['json', 'csv'], default='json')


    newsession_parser = subparsers.add_parser('newsession', 
                                            help='Καταγραφή νέας φόρτισης')
    newsession_parser.add_argument('--id', required=True, help='ID του φορτιστή')
    newsession_parser.add_argument('--starttime', required=True, 
                                 help='Ώρα έναρξης (YYYY-MM-DD HH:MM)')
    newsession_parser.add_argument('--endtime', required=True,
                                 help='Ώρα λήξης (YYYY-MM-DD HH:MM)')
    newsession_parser.add_argument('--startsoc', required=True, type=int,
                                 help='Αρχικό State of Charge (%)')
    newsession_parser.add_argument('--endsoc', required=True, type=int,
                                 help='Τελικό State of Charge (%)')
    newsession_parser.add_argument('--totalkwh', required=True, type=float,
                                 help='Συνολική ενέργεια (kWh)')
    newsession_parser.add_argument('--kwhprice', required=True, type=float,
                                 help='Τιμή ανά kWh (€)')
    newsession_parser.add_argument('--amount', required=True, type=float,
                                 help='Συνολικό ποσό (€)')
    
    
    
    args = parser.parse_args()
    
    
    
    
    args = parser.parse_args()
    
    # Εκτέλεση της επιλεγμένης εντολής
        # Εκτέλεση της επιλεγμένης εντολής
    if args.command == 'healthcheck':
        healthcheck_command()

    elif args.command == 'points':  # <-- ΝΕΑ ΓΡΑΜΜΗ
        data = points_command(status=args.status, format_type=args.format)
        
        # Εμφάνιση αποτελεσμάτων ΜΟΝΟ για points
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        if args.format == 'csv':
            print(data)
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))

    
    elif args.command == 'point':
        data = point_command(point_id=args.id)
        
        # Εμφάνιση αποτελεσμάτων
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        if args.format == 'csv':
            # Για point, το CSV πρέπει να είναι ειδική μορφή
            if isinstance(data, dict) and 'pointid' in data:
                # Δημιουργία CSV format με delimiter "__"
                csv_output = f"pointid__lon__lat__status__cap__reservationendtime__kwhprice\n"
                csv_output += f"{data['pointid']}__{data.get('lon', '')}__{data.get('lat', '')}__"
                csv_output += f"{data.get('status', '')}__{data.get('cap', '')}__"
                csv_output += f"{data.get('reservationendtime', '')}__{data.get('kwhprice', '')}"
                print(csv_output)
            else:
                print("Δεν υπάρχουν δεδομένα για CSV μετατροπή")
        else:
            print(json.dumps(data, indent=2, ensure_ascii=False))

    elif args.command == 'addpoints':
        # Αν ζητήθηκε δημιουργία sample CSV
        if args.create_sample:
            sample_file = create_sample_csv("sample_chargers.csv")
            print(f"✅ Δημιουργήθηκε το αρχείο: {sample_file}")
            print(f"   Τώρα μπορείς να τρέξεις: python cli.py addpoints --source {sample_file}")
        else:
            # Κανονική εκτέλεση addpoints
            result = addpoints_command(csv_file_path=args.source)
            print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
            print(json.dumps(result, indent=2, ensure_ascii=False))

    elif args.command == 'updpoint':
        # Έλεγχος ότι δόθηκε τουλάχιστον μία παράμετρος
        if args.status is None and args.price is None:
            print("❌ Σφάλμα: Πρέπει να δοθεί τουλάχιστον ένα από --status ή --price")
            print("   Χρήση: python cli.py updpoint --id 123 --status available")
            print("   ή: python cli.py updpoint --id 123 --price 0.40")
            print("   ή: python cli.py updpoint --id 123 --status charging --price 0.45")
            return 1
        
        # Εκτέλεση της εντολής
        result = updpoint_command(point_id=args.id, status=args.status, price=args.price)
        
        # Εμφάνιση αποτελεσμάτων
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


    
    elif args.command == 'resetpoints':
        result = resetpoints_command()
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        print(json.dumps(result, indent=2, ensure_ascii=False))


    elif args.command == 'pointstatus':
        result = pointstatus_command(point_id=args.id, 
                                   date_from=args.date_from, 
                                   date_to=args.date_to,
                                   format_type=args.format)
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        if args.format == 'csv':
            print(result)
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))


    elif args.command == 'reserve':
        result = reserve_command(point_id=args.id, minutes=args.minutes)
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Ειδική εμφάνιση για επιτυχημένη δέσμευση
        if result.get('status') == 'reserved':
            print(f"\n✅ ΔΕΣΜΕΥΣΗ ΕΠΙΤΥΧΗΣ!")
            print(f"   Φορτιστής: {result['pointid']}")
            print(f"   Λήγει στις: {result['reservationendtime']}")
            if 'mock_note' in result:
                print(f"   ({result['mock_note']})")


    elif args.command == 'sessions':
        result = sessions_command(point_id=args.id, 
                                date_from=args.date_from, 
                                date_to=args.date_to,
                                format_type=args.format)
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        if args.format == 'csv':
            print(result)
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
        # Επιπλέον στατιστικά για JSON format
        if args.format == 'json' and isinstance(result, list):
            total_sessions = len(result)
            total_kwh = sum(session.get('totalkwh', 0) for session in result)
            total_amount = sum(session.get('amount', 0) for session in result)
            print(f"\n📈 ΣΤΑΤΙΣΤΙΚΑ:")
            print(f"   Συνολικές φορτίσεις: {total_sessions}")
            print(f"   Συνολική ενέργεια: {total_kwh:.1f} kWh")
            print(f"   Συνολικό κόστος: €{total_amount:.2f}")


    elif args.command == 'newsession':
        result = newsession_command(
            point_id=args.id,
            starttime=args.starttime,
            endtime=args.endtime,
            startsoc=args.startsoc,
            endsoc=args.endsoc,
            totalkwh=args.totalkwh,
            kwhprice=args.kwhprice,
            amount=args.amount
        )
        print("\n📊 ΑΠΟΤΕΛΕΣΜΑΤΑ:")
        print(json.dumps(result, indent=2, ensure_ascii=False))
        
        # Ειδική εμφάνιση για επιτυχία
        if result.get('status') == 'success':
            print(f"\n✅ ΦΟΡΤΙΣΗ ΚΑΤΑΓΡΑΦΗΚΕ!")
            print(f"   Session ID: {result.get('session_id', 'N/A')}")
            print(f"   Μήνυμα: {result.get('message', '')}")
    
    else:
        # Αν δεν δοθεί εντολή, εμφάνισε βοήθεια
        parser.print_help()
        return 1


   
if __name__ == "__main__":
    sys.exit(main())