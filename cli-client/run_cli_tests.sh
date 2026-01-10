#!/bin/bash
#
# CLI Test Runner Script
# WATTever Charge Point Management System
# Group 51 - Software Engineering 2025-2026
#

set -e  # Exit on error


echo "CLI Test Suite Runner"

# Check if Python is available
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python3 is not installed or not in PATH"
    exit 1
fi

# Check if required files exist
if [ ! -f "cli.py" ]; then
    echo "ERROR: cli.py not found in current directory"
    echo "Please run this script from the directory containing cli.py"
    exit 1
fi

# Check if test script exists
if [ ! -f "test_cli.py" ]; then
    echo "ERROR: test_cli.py not found in current directory"
    echo "Please ensure test_cli.py is in the same directory as cli.py"
    exit 1
fi

# Run the tests
echo "Starting test execution..."
echo "Timestamp: $(date)"

python3 test_cli.py

echo "Test execution completed"
