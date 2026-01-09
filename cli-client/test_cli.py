"""
CLI Test Script for WATTever Charge Point Management System
Group 51 - Software Engineering 2025-2026
"""

import subprocess
import sys
import json
import time
import csv
import io

def execute_cli_command(command_args, test_description=""):
    """
    Execute a CLI command and return the result
    
    Args:
        command_args: List of arguments for the CLI
        test_description: Description of the test
    
    Returns:
        tuple: (success, result_type, output)
    """
    full_command = [sys.executable, "cli.py"] + command_args
    
    print("\n" + "=" * 70)
    print(f"TEST: {test_description}")
    print(f"Command: python cli.py {' '.join(command_args)}")
    print("=" * 70)
    
    try:
        # Execute the command
        process_result = subprocess.run(
            full_command,
            capture_output=True,
            text=True,
            timeout=10
        )
        
        combined_output = process_result.stdout + process_result.stderr
        
        # Check for mock data usage
        mock_indicators = ["mock", "fallback", "simulated", "NOT READY", "not available"]
        uses_mock_data = any(indicator.lower() in combined_output.lower() 
                           for indicator in mock_indicators)
        
        # Check for API success indicators
        api_success_indicators = ["API βρέθηκε", "απάντησε", "επιτυχής"]
        api_responding = any(indicator in combined_output 
                           for indicator in api_success_indicators)
        
        print(f"Exit code: {process_result.returncode}")
        
        if process_result.returncode == 0:
            if uses_mock_data:
                print("STATUS: Using mock data - API may not be available")
                return False, "mock_data", combined_output
            elif api_responding:
                print("STATUS: Success - Communicating with API")
                return True, "api_success", combined_output
            else:
                print("STATUS: Success - Unable to determine API status")
                return True, "success_unknown", combined_output
        else:
            print(f"STATUS: Failed (exit code: {process_result.returncode})")
            if process_result.stderr:
                print(f"Error output: {process_result.stderr[:200]}")
            return False, "command_failed", combined_output
            
    except subprocess.TimeoutExpired:
        print("STATUS: Timeout - Command took too long")
        return False, "timeout", ""
    except Exception as error:
        print(f"STATUS: Unexpected error - {type(error).__name__}: {error}")
        return False, "exception", str(error)

def validate_csv_output(csv_text):
    """
    Validate CSV format output
    
    Args:
        csv_text: CSV output as string
    
    Returns:
        tuple: (is_valid, error_message, row_count)
    """
    if not csv_text.strip():
        return False, "Empty output", 0
    
    # Check for expected delimiter
    if "__" not in csv_text:
        return False, "Missing expected '__' delimiter", 0
    
    try:
        # Try to parse as CSV with '_' delimiter
        # Note: The specification requires '__' delimiter, but CSV parser uses single '_'
        csv_reader = csv.reader(io.StringIO(csv_text.replace('__', '_')), delimiter='_')
        rows = list(csv_reader)
        
        if len(rows) == 0:
            return False, "No rows in CSV", 0
        
        return True, f"Valid CSV with {len(rows)} rows", len(rows)
        
    except csv.Error as csv_error:
        return False, f"CSV parsing error: {csv_error}", 0
    except Exception as error:
        return False, f"Unexpected error: {error}", 0

def run_comprehensive_test_suite():
    """
    Run all CLI tests and generate comprehensive report
    """
    print("=" * 70)
    print("CLI TEST SUITE - WATTever Charge Point Management")
    print("Group 51 - Software Engineering 2025-2026")
    print("=" * 70)
    
    # Define all test cases
    test_cases = [
        # Basic connectivity tests
        (["healthcheck"], "Basic API connectivity check"),
        
        # Points listing tests
        (["points"], "List all charging points"),
        (["points", "--status", "available"], "List available charging points"),
        (["points", "--status", "charging"], "List charging points in use"),
        (["points", "--status", "reserved"], "List reserved charging points"),
        
        # Format tests
        (["points", "--format", "json"], "List points in JSON format"),
        (["points", "--format", "csv"], "List points in CSV format"),
        (["points", "--status", "available", "--format", "csv"], 
         "List available points in CSV format"),
        
        # Point detail tests
        (["point", "--id", "1"], "Get details for point ID 1"),
        (["point", "--id", "2"], "Get details for point ID 2"),
        
        # Reservation tests
        (["reserve", "--id", "1"], "Reserve point ID 1 for 30 minutes"),
        (["reserve", "--id", "2", "--minutes", "45"], "Reserve point ID 2 for 45 minutes"),
        (["reserve", "--id", "3", "--minutes", "60"], "Reserve point ID 3 for 60 minutes"),
        
        # Update tests
        (["updpoint", "--id", "1", "--status", "charging"], "Update point ID 1 status to charging"),
        (["updpoint", "--id", "2", "--status", "available"], "Update point ID 2 status to available"),
        (["updpoint", "--id", "1", "--price", "0.40"], "Update point ID 1 price to 0.40"),
        (["updpoint", "--id", "3", "--status", "malfunction", "--price", "0.35"], 
         "Update point ID 3 status and price"),
        
        # Session history tests
        (["sessions", "--id", "1", "--from", "20250101", "--to", "20251231"], 
         "Get charging sessions for point ID 1"),
        (["sessions", "--id", "1", "--from", "20250101", "--to", "20251231", "--format", "csv"], 
         "Get charging sessions in CSV format"),
        
        # Point status history tests
        (["pointstatus", "--id", "1", "--from", "20250101", "--to", "20251231"], 
         "Get status history for point ID 1"),
        (["pointstatus", "--id", "1", "--from", "20250101", "--to", "20251231", "--format", "csv"], 
         "Get status history in CSV format"),
        
        # New session recording test
        (["newsession", 
          "--id", "1510",
          "--starttime", "2025-11-10 19:00",
          "--endtime", "2025-11-10 22:00",
          "--startsoc", "20",
          "--endsoc", "40",
          "--totalkwh", "10.0",
          "--kwhprice", "0.50",
          "--amount", "5.0"], 
         "Record new charging session"),
        
        # Administrative commands
        (["resetpoints"], "Reset database to initial state"),
    ]
    
    test_results = []
    passed_count = 0
    failed_count = 0
    
    # Execute all tests
    for command_args, description in test_cases:
        success, result_type, output = execute_cli_command(command_args, description)
        
        test_results.append({
            "command": " ".join(command_args),
            "description": description,
            "success": success,
            "result_type": result_type,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        })
        
        if success:
            passed_count += 1
            print("RESULT: PASSED")
        else:
            failed_count += 1
            print("RESULT: FAILED")
        
        # Brief pause between tests
        time.sleep(1)
    
    # Generate detailed report
    print("\n" + "=" * 70)
    print("TEST EXECUTION REPORT")
    print("=" * 70)
    
    # Summary statistics
    total_tests = len(test_cases)
    success_rate = (passed_count / total_tests * 100) if total_tests > 0 else 0
    
    print(f"\nSUMMARY STATISTICS:")
    print(f"  Total tests executed: {total_tests}")
    print(f"  Tests passed: {passed_count}")
    print(f"  Tests failed: {failed_count}")
    print(f"  Success rate: {success_rate:.1f}%")
    
    # Detailed results
    print(f"\nDETAILED RESULTS:")
    print("-" * 70)
    
    for index, result in enumerate(test_results, 1):
        status = "PASS" if result["success"] else "FAIL"
        print(f"{index:3d}. [{status}] {result['command']:45} - {result['result_type']}")
    
    # Categorize failures
    failure_types = {}
    for result in test_results:
        if not result["success"]:
            failure_type = result["result_type"]
            failure_types[failure_type] = failure_types.get(failure_type, 0) + 1
    
    if failure_types:
        print(f"\nFAILURE ANALYSIS:")
        for failure_type, count in failure_types.items():
            print(f"  {failure_type}: {count} failures")
    
    # API communication analysis
    api_tests = [r for r in test_results if "points" in r["command"] or "healthcheck" in r["command"]]
    api_with_mock = [r for r in api_tests if r["result_type"] == "mock_data"]
    
    if api_with_mock:
        print(f"\nWARNING: {len(api_with_mock)} out of {len(api_tests)} API tests used mock data")
        print("This may indicate that the API is not available or not responding correctly")
    
    # Save results to file
    report_data = {
        "test_suite": "CLI Functional Tests",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "environment": {
            "python_version": sys.version,
            "platform": sys.platform
        },
        "statistics": {
            "total_tests": total_tests,
            "passed": passed_count,
            "failed": failed_count,
            "success_rate": success_rate
        },
        "test_cases": test_results,
        "failure_analysis": failure_types
    }
    
    report_filename = f"cli_test_report_{time.strftime('%Y%m%d_%H%M%S')}.json"
    
    try:
        with open(report_filename, "w") as report_file:
            json.dump(report_data, report_file, indent=2, ensure_ascii=False)
        print(f"\nDetailed report saved to: {report_filename}")
    except Exception as save_error:
        print(f"\nWarning: Could not save report file: {save_error}")
    
    print("\n" + "=" * 70)
    
    if failed_count == 0:
        print("ALL TESTS COMPLETED SUCCESSFULLY")
        return 0
    else:
        print(f"TESTING COMPLETE WITH {failed_count} FAILURES")
        return 1

def run_api_communication_test():
    """
    Specialized test to verify CLI-API communication
    """
    print("\n" + "=" * 70)
    print("API COMMUNICATION VERIFICATION TEST")
    print("=" * 70)
    
    test_commands = [
        ["healthcheck"],
        ["points"],
        ["point", "--id", "1"]
    ]
    
    api_connections = 0
    mock_usage = 0
    
    for command in test_commands:
        success, result_type, output = execute_cli_command(command, f"API test: {' '.join(command)}")
        
        if result_type == "api_success":
            api_connections += 1
            print("VERDICT: CLI is communicating with API")
        elif result_type == "mock_data":
            mock_usage += 1
            print("VERDICT: CLI is using mock data (API not available)")
        else:
            print("VERDICT: Unable to determine API status")
    
    print(f"\nAPI Communication Summary:")
    print(f"  Successful API connections: {api_connections}")
    print(f"  Mock data usage instances: {mock_usage}")
    
    if api_connections > 0 and mock_usage == 0:
        print("\nCONCLUSION: CLI is properly configured to communicate with API")
        return True
    else:
        print("\nCONCLUSION: CLI may not be properly communicating with API")
        return False

def run_csv_format_validation():
    """
    Validate CSV format output according to specifications
    """
    print("\n" + "=" * 70)
    print("CSV FORMAT VALIDATION TEST")
    print("=" * 70)
    
    csv_tests = [
        (["points", "--format", "csv"], "Points list CSV"),
        (["sessions", "--id", "1", "--from", "20250101", "--to", "20251231", "--format", "csv"], 
         "Sessions CSV"),
    ]
    
    for command_args, test_name in csv_tests:
        print(f"\nTesting: {test_name}")
        success, result_type, output = execute_cli_command(command_args, test_name)
        
        if success and output:
            is_valid, message, row_count = validate_csv_output(output)
            
            if is_valid:
                print(f"  CSV VALIDATION: PASSED - {message}")
            else:
                print(f"  CSV VALIDATION: FAILED - {message}")
        else:
            print(f"  CSV VALIDATION: SKIPPED - Command failed or no output")

if __name__ == "__main__":
    """
    Main execution entry point
    """
    try:
        print("Starting CLI Test Suite...")
        
        # Run the main test suite
        exit_code = run_comprehensive_test_suite()
        
        # Optional: Run specialized tests
        if exit_code == 0:
            print("\n" + "=" * 70)
            print("RUNNING ADDITIONAL VALIDATION TESTS")
            print("=" * 70)
            
            # Verify API communication
            api_ok = run_api_communication_test()
            
            # Validate CSV format
            run_csv_format_validation()
        
        print("\nTest execution completed.")
        sys.exit(exit_code)
        
    except KeyboardInterrupt:
        print("\n\nTest execution interrupted by user.")
        sys.exit(1)
    except Exception as main_error:
        print(f"\nUnexpected error in test suite: {main_error}")
        sys.exit(1)