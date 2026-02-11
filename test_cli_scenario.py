import subprocess
import os
import sys
import time

# Ρυθμίσεις Διαδρομών
CURRENT_DIR = os.getcwd()
CLI_DIR = os.path.join(CURRENT_DIR, "cli")
CLI_SCRIPT = os.path.join(CLI_DIR, "cli.py")
PYTHON_CMD = sys.executable  # Χρησιμοποιεί τον ίδιο python interpreter που τρέχει το script

# Χρώματα για το τερματικό
GREEN = "\033[92m"
RED = "\033[91m"
RESET = "\033[0m"
BOLD = "\033[1m"

def run_cli_command(args_str, description):
    """Εκτελεί το cli.py με τα δοσμένα ορίσματα."""
    print(f"{BOLD}👉 Έλεγχος: {description}{RESET}")
    
    # Συναρμολόγηση εντολής: python3 cli/cli.py <args>
    cmd = [PYTHON_CMD, CLI_SCRIPT] + args_str.split()
    print(f"   Εντολή: {' '.join(cmd)}")
    
    try:
        # Εκτέλεση και καταγραφή αποτελέσματος
        result = subprocess.run(
            cmd, 
            capture_output=True, 
            text=True
        )
        
        output = result.stdout.strip()
        error = result.stderr.strip()
        
        # Έλεγχος αποτελέσματος
        if result.returncode == 0:
            print(f"{GREEN}✅ ΕΠΙΤΥΧΙΑ{RESET}")
            # Προεπισκόπηση output (πρώτες 2 γραμμές)
            lines = output.split('\n')
            preview = lines[0] if lines else "[Empty Output]"
            print(f"   Output: {preview}")
            if len(lines) > 1: print(f"           {lines[1]}...")
            return True
        else:
            print(f"{RED}❌ ΑΠΟΤΥΧΙΑ (Return Code: {result.returncode}){RESET}")
            if error:
                print(f"   Error: {error}")
            return False

    except Exception as e:
        print(f"{RED}❌ CRITICAL ERROR: {str(e)}{RESET}")
        return False
    finally:
        print("-" * 60)

def create_dummy_csv():
    """Δημιουργεί προσωρινό αρχείο CSV για το addpoints [cite: 46]"""
    filename = "test_chargers.csv"
    with open(filename, "w", encoding="utf-8") as f:
        # Header σύμφωνα με το format που περιμένει το addpoints
        f.write("station_id,station_name,address,latitude,longitude,charger_id,connector_type,max_power_kw\n")
        f.write("ST_TEST,TestStation,TestAddress,38.0,23.0,CH_TEST_01,Type 2,22\n")
    return filename

def main():
    # Έλεγχος αν υπάρχει το cli.py
    if not os.path.exists(CLI_SCRIPT):
        print(f"{RED}Σφάλμα: Δεν βρέθηκε το αρχείο {CLI_SCRIPT}!{RESET}")
        print(f"Βεβαιώσου ότι τρέχεις το script από τον φάκελο 'softeng25-51'")
        sys.exit(1)

    print(f"{BOLD}=== ΕΝΑΡΞΗ ΕΛΕΓΧΟΥ CLI (Βάσει Εκφώνησης) ==={RESET}\n")

    # 1. Healthcheck [cite: 34, 240]
    run_cli_command("healthcheck", "Healthcheck (Default CSV)")

    # 2. Reset Points [cite: 43, 240]
    run_cli_command("resetpoints", "Reset Database")
    time.sleep(1) # Αναμονή για τη βάση

    # 3. Add Points [cite: 46, 240]
    csv_file = create_dummy_csv()
    run_cli_command(f"addpoints --source {csv_file}", "Add Points from CSV")
    
    # 4. List Points (Default CSV) [cite: 58, 240]
    run_cli_command("points", "List All Points (CSV)")

    # 5. List Points (JSON Format) [cite: 22, 240]
    run_cli_command("points --format json", "List All Points (JSON)")

    # 6. Point Details [cite: 95, 240]
    # Χρησιμοποιούμε το ID 1 που υπάρχει στα αρχικά δεδομένα
    run_cli_command("point --id 1", "Show Point Details (ID=1)")

    # 7. Reserve Point [cite: 110, 240]
    run_cli_command("reserve --id 1 --minutes 45", "Reserve Point (ID=1, 45 min)")

    # 8. Update Point [cite: 126, 240]
    run_cli_command("updpoint --id 1 --price 0.55", "Update Point Price (ID=1)")

    # 9. Point Status History [cite: 201, 240]
    # Ημερομηνίες YYYYMMDD όπως απαιτείται
    run_cli_command("pointstatus --id 1 --from 20250101 --to 20261231", "Point Status History")

    # 10. Sessions History [cite: 166, 240]
    run_cli_command("sessions --id 1 --from 20250101 --to 20261231", "Charging Sessions History")

    # Καθαρισμός
    if os.path.exists(csv_file):
        os.remove(csv_file)

    print(f"\n{BOLD}=== ΤΕΛΟΣ ΕΛΕΓΧΟΥ CLI ==={RESET}")

if __name__ == "__main__":
    main()