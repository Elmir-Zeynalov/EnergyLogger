import csv
import os

def initialize_csv(file_name):
    """Initialize the CSV file and write headers if it doesn't exist."""
    headers = [
        "Timestamp",
        "UTC (ms)",
        "Absolute Active Energy (Wh)",
        "Power Active (W)",
        "Voltage (V)",
        "Current (A)",
        "Frequency (Hz)",
        "Power Factor (PF)",
        "Power Angle (deg)",
        "Power Apparent (VA)",
        "Power Reactive (VAR)",
        "Absolute Active Energy Resettable (Wh)",
        "Absolute Reactive Energy (VARh)",
        "Absolute Reactive Energy Resettable (VARh)",
        "Reset Time (sec)",
        "Forward Active Energy (Wh)",
        "Forward Reactive Energy (VARh)",
        "Forward Active Energy Resettable (Wh)",
        "Forward Reactive Energy Resettable (VARh)",
        "Reverse Active Energy (Wh)",
        "Reverse Reactive Energy (VARh)",
        "Reverse Active Energy Resettable (Wh)",
        "Reverse Reactive Energy Resettable (VARh)",
        "Residual Current Type A (A)",
        "Time Taken (µs)"
    ]

    if not os.path.exists(file_name):
        with open(file_name, mode='w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(headers)

def log_data(file_name, data):
    """Append a new row of data to the CSV file."""
    with open(file_name, mode='a', newline='') as file:
        writer = csv.writer(file)
        writer.writerow(data)
