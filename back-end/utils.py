from datetime import datetime
from fastapi import Request

def create_error_log(request: Request, code: int, error_msg: str, debug_info: str = ""):
    """
    Επιστρέφει το JSON αντικείμενο σφάλματος βάσει προδιαγραφών.
    """
    return {
        "call": str(request.url),                              # Το πλήρες url της κλήσης 
        "timeref": datetime.now().strftime("%Y-%m-%d %H:%M"), # Timestamp YYYY-MM-DD hh:mm [cite: 493, 516]
        "originator": request.client.host,                    # ΙΡ προέλευσης 
        "return code": code,                                  # Ο http κωδικός 
        "error": error_msg,                                   # Περιγραφή σφάλματος 
        "debuginfo": debug_info                               # Λοιπά στοιχεία 
    }