import json
import pandas as pd
import sys

# Check if a filename is provided
if len(sys.argv) < 2:
    print("Usage: python interpret.py <filename.har>")
    sys.exit(1)

# Get filename from command-line argument
filename = sys.argv[1]

# Load the HAR file
try:
    with open(filename, "r", encoding="utf-8") as f:
        har_data = json.load(f)
except FileNotFoundError:
    print(f"Error: File '{filename}' not found.")
    sys.exit(1)

# Extract entries
entries = har_data.get("log", {}).get("entries", [])

# Extract required fields
data = []
for entry in entries:
    request_url = entry.get("request", {}).get("url", "N/A")
    started_date_time = entry.get("startedDateTime", "N/A")
    transfer_size = entry.get("response", {}).get("_transferSize", "N/A")
    status_code = entry.get("response", {}).get("status", "N/A")
    protocol = entry.get("request", {}).get("httpVersion", "N/A")
    content = entry.get("response", {}).get("content", {})

    content_size = content.get("size", "N/A")
    mime_type = content.get("mimeType", "N/A")

    # Store extracted values
    data.append({
        "Request URL": request_url,
        "Started DateTime": started_date_time,
        "Protocol": protocol,
        "Status Code": status_code,
        "Content Size": content_size,
        "MIME Type": mime_type,
        "Transfer Size": transfer_size
    })

# Convert to DataFrame
df = pd.DataFrame(data)

# Save to CSV
output_filename = "output.csv"
df.to_csv(output_filename, index=False)
print(f"✅ Data saved to {output_filename}")

# Optionally, print first 5 rows
print(df.head())
