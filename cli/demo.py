import os

# Πώς καλούμε το CLI 
CLI = "python3 cli.py"


X = "5085512" \
""

steps = [
    ("Έλεγχος λειτουργίας", f"{CLI} healthcheck"),
    ("Αρχικοποίηση", f"{CLI} resetpoints"),
    ("Προσθήκη κάποιων σημείων (προαπαιτεί αρχείο passes.csv δίπλα στο script)", f"{CLI} addpoints --source passes.csv"),
    ("Έλεγχος λειτουργίας (μετά την προσθήκη)", f"{CLI} healthcheck"),
    ("Επισκόπηση διαθέσιμων", f"{CLI} points --status available"),
    ("Επισκόπηση σε φόρτιση", f"{CLI} points --status charging"),
    ("Επισκόπηση εκτός λειτουργίας", f"{CLI} points --status offline"),
    (f"Πληροφορίες σημείου {X}", f"{CLI} point --id {X}"),
    (f"Δέσμευση σημείου {X}", f"{CLI} reserve --id {X}"),
    ("Επισκόπηση δεσμευμένων", f"{CLI} points --status reserved"),
    (f"Πληροφορίες σημείου {X} (μετά τη δέσμευση)", f"{CLI} point --id {X}"),
    (f"Αποδέσμευση σημείου {X}", f"{CLI} updpoint --id {X} --status available"),
    (f"Πληροφορίες σημείου {X} (μετά την αποδέσμευση)", f"{CLI} point --id {X}"),
    (f"Νέα δέσμευση σημείου {X}", f"{CLI} reserve --id {X}"),
    ("Έλεγχος δεσμευμένων σημείων", f"{CLI} points --status reserved"),
    ("Καταγραφή φόρτισης 1 (E1 > S1)", f"{CLI} newsession --id {X} --starttime '2025-11-01 10:00' --endtime '2025-11-01 11:00' --startsoc 10 --endsoc 30 --totalkwh 15 --kwhprice 0.5 --amount 7.5"),
    (f"Ιστορικό σημείου {X} (Μετά τη φόρτιση 1)", f"{CLI} pointstatus --id {X} --from 20251101 --to 20251101"),
    (f"Πληροφορίες σημείου {X}", f"{CLI} point --id {X}"),
    ("Καταγραφή φόρτισης 2 (S2 > E1 && E2 > S2)", f"{CLI} newsession --id {X} --starttime '2025-11-01 12:00' --endtime '2025-11-01 14:00' --startsoc 50 --endsoc 80 --totalkwh 20 --kwhprice 0.6 --amount 12"),
    (f"Ιστορικό φορτίσεων σημείου {X}", f"{CLI} sessions --id {X} --from 20251101 --to 20251102"),
    (f"Κατάσταση σημείου {X}", f"{CLI} pointstatus --id {X} --from 20251101 --to 20251102")
]

def run_demo():
    print("==================================================")
    print("  CLI DEMO SCRIPT - WATTever")
    print("==================================================")
    
    for i, (desc, cmd) in enumerate(steps, 1):
        print(f"\n[{i}/{len(steps)}] {desc}")
        print(f"Εκτελείται: {cmd}")
        input("👉 Πάτα Enter για εκτέλεση... ")
        print("-" * 50)
        os.system(cmd)
        print("-" * 50)
        
    print("\n✅ Το σενάριο επίδειξης ολοκληρώθηκε!")

if __name__ == '__main__':
    run_demo()