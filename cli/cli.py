#!/usr/bin/env python3
import argparse
import sys
import json
import csv
import os
import io
import requests

# Απενεργοποίηση warnings για self-signed certificates (λόγω localhost/https)
from requests.packages.urllib3.exceptions import InsecureRequestWarning
requests.packages.urllib3.disable_warnings(InsecureRequestWarning)

BASE_URL = "https://localhost:9876/api"

# --- HELPER FUNCTIONS ---

def print_result(data, format_type='json'):
    """Τυπώνει τα δεδομένα στο stdout. Tα errors πάνε στο stderr."""
    try:
        if format_type == 'csv':
            # Αν το API επιστρέφει ήδη CSV text (περίπτωση text/csv)
            if isinstance(data, str): 
                print(data)
            # Αν έχουμε λίστα από dicts και θέλουμε να τα κάνουμε CSV
            elif isinstance(data, list) and len(data) > 0:
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=data[0].keys())
                writer.writeheader()
                writer.writerows(data)
                print(output.getvalue().strip())
            # Αν είναι ένα απλό dict
            elif isinstance(data, dict):
                output = io.StringIO()
                writer = csv.DictWriter(output, fieldnames=data.keys())
                writer.writeheader()
                writer.writerow(data)
                print(output.getvalue().strip())
            else:
                print("") # Empty result
        else:
            # Default JSON format
            print(json.dumps(data, indent=2, ensure_ascii=False))
    except Exception as e:
        print(f"Error formatting output: {e}", file=sys.stderr)

def safe_request(method, url, **kwargs):
    """Κεντρική διαχείριση requests για να πιάνουμε τα errors σωστά."""
    try:
        # verify=False γιατί τρέχουμε localhost με self-signed certs συνήθως
        response = requests.request(method, url, verify=False, **kwargs)
        
        # Προσπαθούμε να πάρουμε JSON, αλλιώς επιστρέφουμε το text (π.χ. για CSV responses)
        try:
            return response.json()
        except json.JSONDecodeError:
            return response.text
            
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to API server.", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

# --- COMMAND FUNCTIONS ---

def healthcheck_command(args):
    data = safe_request('GET', f"{BASE_URL}/admin/healthcheck")
    print_result(data, args.format)

def resetpoints_command(args):
    data = safe_request('POST', f"{BASE_URL}/admin/resetpoints")
    print_result(data, args.format)

def addpoints_command(args):
    if not os.path.exists(args.source):
        print(f"Error: File '{args.source}' not found.", file=sys.stderr)
        sys.exit(1)
    
    with open(args.source, 'rb') as f:
        files = {'file': (os.path.basename(args.source), f, 'text/csv')}
        data = safe_request('POST', f"{BASE_URL}/admin/addpoints", files=files)
        print_result(data, args.format)

def points_command(args):
    params = {'format': args.format}
    if args.status:
        params['status'] = args.status
    
    # Αν το format είναι csv, το API πιθανώς να επιστρέφει text/csv
    response = requests.get(f"{BASE_URL}/points", params=params, verify=False)
    
    if args.format == 'csv':
        print(response.text.strip())
    else:
        try:
            print_result(response.json(), 'json')
        except:
            print(response.text)

def point_command(args):
    data = safe_request('GET', f"{BASE_URL}/point/{args.id}")
    print_result(data, args.format)

def reserve_command(args):
    url = f"{BASE_URL}/reserve/{args.id}"
    if args.minutes:
        url += f"/{args.minutes}"
    
    data = safe_request('POST', url)
    print_result(data, args.format)

def updpoint_command(args):
    payload = {}
    if args.status: payload['status'] = args.status
    if args.price: payload['kwhprice'] = args.price
    
    if not payload:
        print("Error: At least one of --status or --price is required.", file=sys.stderr)
        sys.exit(1)

    data = safe_request('POST', f"{BASE_URL}/updpoint/{args.id}", json=payload)
    print_result(data, args.format)

def newsession_command(args):
    payload = {
        "id": args.id,
        "starttime": args.starttime,
        "endtime": args.endtime,
        "startsoc": args.startsoc,
        "endsoc": args.endsoc,
        "totalkwh": args.totalkwh,
        "kwhprice": args.kwhprice,
        "amount": args.amount
    }
    data = safe_request('POST', f"{BASE_URL}/newsession", json=payload)
    print_result(data, args.format)

def sessions_command(args):
    url = f"{BASE_URL}/sessions/{args.id}/{args.date_from}/{args.date_to}"
    params = {'format': args.format}
    
    response = requests.get(url, params=params, verify=False)
    if args.format == 'csv':
        print(response.text.strip())
    else:
        try:
            print_result(response.json(), 'json')
        except:
            print(response.text)

def pointstatus_command(args):
    url = f"{BASE_URL}/pointstatus/{args.id}/{args.date_from}/{args.date_to}"
    params = {'format': args.format}
    
    response = requests.get(url, params=params, verify=False)
    if args.format == 'csv':
        print(response.text.strip())
    else:
        try:
            print_result(response.json(), 'json')
        except:
            print(response.text)

# --- MAIN PARSER ---

def main():
    parser = argparse.ArgumentParser(prog='se2551')
    subparsers = parser.add_subparsers(dest='scope', required=True)

    # 1. Healthcheck
    p_health = subparsers.add_parser('healthcheck')
    p_health.add_argument('--format', default='csv')
    p_health.set_defaults(func=healthcheck_command)

    # 2. Resetpoints
    p_reset = subparsers.add_parser('resetpoints')
    p_reset.add_argument('--format', default='csv')
    p_reset.set_defaults(func=resetpoints_command)

    # 3. Addpoints
    p_add = subparsers.add_parser('addpoints')
    p_add.add_argument('--source', required=True)
    p_add.add_argument('--format', default='csv')
    p_add.set_defaults(func=addpoints_command)

    # 4. Points
    p_points = subparsers.add_parser('points')
    p_points.add_argument('--status')
    p_points.add_argument('--format', default='csv')
    p_points.set_defaults(func=points_command)

    # 5. Point
    p_point = subparsers.add_parser('point')
    p_point.add_argument('--id', required=True)
    p_point.add_argument('--format', default='csv')
    p_point.set_defaults(func=point_command)

    # 6. Reserve
    p_reserve = subparsers.add_parser('reserve')
    p_reserve.add_argument('--id', required=True)
    p_reserve.add_argument('--minutes', type=int)
    p_reserve.add_argument('--format', default='csv')
    p_reserve.set_defaults(func=reserve_command)

    # 7. Updpoint
    p_upd = subparsers.add_parser('updpoint')
    p_upd.add_argument('--id', required=True)
    p_upd.add_argument('--status')
    p_upd.add_argument('--price', type=float)
    p_upd.add_argument('--format', default='csv')
    p_upd.set_defaults(func=updpoint_command)

    # 8. Newsession
    p_new = subparsers.add_parser('newsession')
    p_new.add_argument('--id', required=True)
    p_new.add_argument('--starttime', required=True)
    p_new.add_argument('--endtime', required=True)
    p_new.add_argument('--startsoc', type=int, required=True)
    p_new.add_argument('--endsoc', type=int, required=True)
    p_new.add_argument('--totalkwh', type=float, required=True)
    p_new.add_argument('--kwhprice', type=float, required=True)
    p_new.add_argument('--amount', type=float, required=True)
    p_new.add_argument('--format', default='csv')
    p_new.set_defaults(func=newsession_command)

    # 9. Sessions
    p_sess = subparsers.add_parser('sessions')
    p_sess.add_argument('--id', required=True)
    p_sess.add_argument('--from', dest='date_from', required=True)
    p_sess.add_argument('--to', dest='date_to', required=True)
    p_sess.add_argument('--format', default='csv')
    p_sess.set_defaults(func=sessions_command)

    # 10. Pointstatus
    p_stat = subparsers.add_parser('pointstatus')
    p_stat.add_argument('--id', required=True)
    p_stat.add_argument('--from', dest='date_from', required=True)
    p_stat.add_argument('--to', dest='date_to', required=True)
    p_stat.add_argument('--format', default='csv')
    p_stat.set_defaults(func=pointstatus_command)

    # Parse and Execute
    args = parser.parse_args()
    if hasattr(args, 'func'):
        args.func(args)
    else:
        parser.print_help()

if __name__ == '__main__':
    main()