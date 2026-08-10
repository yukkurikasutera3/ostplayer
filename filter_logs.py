import json
import os

filename = 'console_logs_raw.txt'
if not os.path.exists(filename):
    print(f"Log file '{filename}' not found. Nothing to scan.")
else:
    try:
        with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        matched = 0
        for line in lines:
            if '"logs"' in line or '"consoleLogs"' in line or 'console_logs' in line:
                print(line[:1000])
                matched += 1

        print(f"Scan complete! Matched {matched} log entries.")
    except Exception as e:
        print(f"Error reading {filename}: {e}")

