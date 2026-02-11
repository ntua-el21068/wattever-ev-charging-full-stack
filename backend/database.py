import mysql.connector
from fastapi import HTTPException

# ΡΥΘΜΙΣΕΙΣ ΒΑΣΗΣ - Κεντρική διαχείριση υπηρεσιών δεδομένων
DB_CONFIG = {
    'host': 'localhost',
    'user': 'softeng_user',
    'password': 'softeng_pass',
    'database': 'wattever_db'
}

def get_db_connection():
    """Υπηρεσία διασύνδεσης με τη βάση δεδομένων (Backend Service)"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {err}")