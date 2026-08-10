import json

with open('console_logs_raw.txt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for line in lines:
    if '"logs"' in line or '"consoleLogs"' in line or 'console_logs' in line:
        print(line[:1000])

print("Scan complete!")
