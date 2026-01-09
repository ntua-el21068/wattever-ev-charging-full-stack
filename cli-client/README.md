# CLI client


## Εκτέλεση Tests
```bash
python test_cli.py

##Σύνολο Εντολών

# Έλεγχος σύνδεσης
python cli.py healthcheck

# Λίστα φορτιστών
python cli.py points
python cli.py points --status available
python cli.py points --status charging
python cli.py points --status reserved

# Διαφορετικές μορφές εξόδου
python cli.py points --format json
python cli.py points --format csv
python cli.py points --status available --format csv
# Πληροφορίες συγκεκριμένου φορτιστή
python cli.py point --id <REAL_ID>

# Δέσμευση φορτιστή
python cli.py reserve --id <REAL_ID>
python cli.py reserve --id <REAL_ID> --minutes 45

# Ενημέρωση φορτιστή
python cli.py updpoint --id <REAL_ID> --status charging
python cli.py updpoint --id <REAL_ID> --price 0.40
python cli.py updpoint --id <REAL_ID> --status malfunction --price 0.35
# Ιστορικό φορτίσεων
python cli.py sessions --id <REAL_ID> --from 20250101 --to 20251231
python cli.py sessions --id <REAL_ID> --from 20250101 --to 20251231 --format csv

# Ιστορικό αλλαγών κατάστασης
python cli.py pointstatus --id <REAL_ID> --from 20250101 --to 20251231
python cli.py pointstatus --id <REAL_ID> --from 20250101 --to 20251231 --format csv

#Δημιουργία σεσσιον
python cli.py newsession \
  --id <REAL_ID> \
  --starttime "2025-11-10 19:00" \
  --endtime "2025-11-10 22:00" \
  --startsoc 20 \
  --endsoc 40 \
  --totalkwh 10.0 \
  --kwhprice 0.50 \
  --amount 5.0

  #Ρισετ ποιντς
  python cli.py resetpoints
