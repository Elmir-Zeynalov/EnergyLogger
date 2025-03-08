#!/usr/bin/env python3
import serial
import time
import csv
import re
import argparse
from datetime import datetime

def parse_arguments():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(description="Log AT+QTEMP temperature data to a CSV file dynamically.")
    parser.add_argument("--csv", type=str, default="temperature_log.csv", help="CSV output filename (default: temperature_log.csv)")
    return parser.parse_args()

def extract_temperatures(response_lines):
    """Extract sensor names and temperature values dynamically from the modem response."""
    temp_data = {}  # Dictionary to hold dynamic sensor values

    for line in response_lines:
        match = re.match(r'\+QTEMP:"([^"]+)",\s*"(\d+)"', line)  # Extract "sensor_name","value"
        if match:
            sensor_name, temperature = match.groups()
            temp_data[sensor_name] = int(temperature)  # Store as integer

    return temp_data  # Returns {sensor_name: temperature_value}

def update_csv_headers(filename, new_sensors):
    """Ensure CSV file contains all sensor columns by updating headers dynamically."""
    try:
        with open(filename, 'r', newline='') as file:
            reader = csv.reader(file)
            headers = next(reader, [])
    except FileNotFoundError:
        headers = ["Timestamp"]  # If file doesn't exist, start with just the timestamp column

    # Add any new sensors dynamically
    updated_headers = list(headers)  # Copy existing headers
    for sensor in new_sensors:
        if sensor not in updated_headers:
            updated_headers.append(sensor)  # Add new sensor columns

    # If headers were modified, rewrite the file with new headers
    if updated_headers != headers:
        with open(filename, 'w', newline='') as file:
            writer = csv.writer(file)
            writer.writerow(updated_headers)

    return updated_headers  # Return updated headers

def log_to_csv(filename, timestamp, temperature_data):
    """Append a new entry to the CSV file, dynamically adjusting columns."""
    # Ensure headers are up to date with all sensor names
    headers = update_csv_headers(filename, temperature_data.keys())

    try:
        with open(filename, mode='a', newline='') as file:
            writer = csv.writer(file)
            
            # Create row with timestamp + dynamic sensor values (preserving order)
            row = [timestamp] + [temperature_data.get(sensor, "") for sensor in headers[1:]]  # Skip "Timestamp"
            writer.writerow(row)
    except Exception as e:
        print(f"Error writing to CSV: {e}")

def print_to_terminal(timestamp, temperature_data):
    """Print the data in a structured format similar to the old script."""
    print(f"\n{timestamp}")  # Print timestamp on a separate line
    for sensor, value in temperature_data.items():
        print(f"{sensor}: {value}")
    print("")  # Add a blank line for readability

def main():
    # Parse command-line arguments
    args = parse_arguments()
    csv_filename = args.csv  # Get CSV filename from argument

    # Serial port configuration
    serial_port = '/dev/ttyUSB2'  # Adjust as needed
    baud_rate = 115200
    timeout = 1  # Read timeout in seconds

    try:
        # Open the serial port
        with serial.Serial(serial_port, baud_rate, timeout=timeout) as ser:
            print(f"Connected to {serial_port} at {baud_rate} baud.")
            print(f"Logging AT+QTEMP responses to {csv_filename}. Press Ctrl+C to stop.")

            while True:
                # Send the AT+QTEMP command
                command = "AT+QTEMP\r"
                ser.write(command.encode('utf-8'))

                # Allow the modem time to process and respond
                time.sleep(0.1)  # Increased polling rate (10 times per second)

                response_lines = []
                while ser.in_waiting:
                    try:
                        response_line = ser.readline().decode('utf-8', errors='replace').strip()
                        if response_line and response_line.startswith("+QTEMP"):  # Capture only temperature lines
                            response_lines.append(response_line)
                    except Exception as read_error:
                        print(f"Error reading line: {read_error}")

                if response_lines:
                    timestamp = int(datetime.utcnow().timestamp() * 1000)  # Unix timestamp in milliseconds
                    temperature_data = extract_temperatures(response_lines)

                    print_to_terminal(timestamp, temperature_data)  # Print structured data to terminal
                    log_to_csv(csv_filename, timestamp, temperature_data)  # Log to specified CSV file

    except KeyboardInterrupt:
        print("\nPolling stopped by user.")

    except serial.SerialException as serial_err:
        print(f"Serial error: {serial_err}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    main()
