import csv
import os

# Define CSV header
CSV_HEADER = [
    "UTC", "Voltage (V)", "Current (A)", "Active Power (W)", "Computed Power (W)", "Frequency (Hz)", 
    "Apparent Power (VA)", "Power Factor (PF)", "Total Energy (Wh)", "Resettable Energy (Wh)", "Elapsed Time (µs)"
]

def init_csv(file_name):
    """Initialize the CSV file if it doesn't exist."""
    file_exists = os.path.isfile(file_name)
    if not file_exists:
        with open(file_name, mode="w", newline="") as file:
            writer = csv.writer(file)
            writer.writerow(CSV_HEADER)  # Write the header

def log_to_csv(file_name, data):
    """Append data to the CSV file."""
    with open(file_name, mode="a", newline="") as file:
        writer = csv.writer(file)
        writer.writerow(data)
