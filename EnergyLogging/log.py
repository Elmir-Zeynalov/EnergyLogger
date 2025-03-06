import requests
import time
import argparse
import csv
import os
from datetime import datetime, timezone

URL = "http://192.168.0.2/statusjsn.js?components=1073741823"

# Function to fetch data from the device
def fetch_data(url):
    start_time = time.time()
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        
        # Extract UTC timestamps
        utc_now = datetime.now(timezone.utc)
        human_readable_utc = utc_now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]  # Human-readable format with milliseconds
        unix_timestamp_ms = int(utc_now.timestamp() * 1000)  # Milliseconds since epoch
        
        # Extract sensor values
        sensor_values = data.get("sensor_values", [])[0].get("values", [])[0]
        metrics = {
            "Voltage (V)": sensor_values[0]["v"],
            "Current (A)": sensor_values[1]["v"],
            "Frequency (Hz)": sensor_values[2]["v"],
            "Active Power (W)": sensor_values[4]["v"],
            "Apparent Power (VA)": sensor_values[6]["v"],
            "Power Factor (PF)": round(sensor_values[7]["v"], 2),  # Store PF as received with 2 decimals
            "Total Energy (Wh)": sensor_values[8]["v"] * 1000,  # Convert kWh to Wh
            "Resettable Energy (Wh)": sensor_values[9]["v"] * 1000,  # Convert kWh to Wh
        }
        
        # Compute apparent power manually
        computed_apparent_power = round(metrics["Voltage (V)"] * metrics["Current (A)"], 3)
        
        # Compute more precise active power manually
        computed_active_power = round(
            metrics["Voltage (V)"] * metrics["Current (A)"] * metrics["Power Factor (PF)"], 3
        )
        
        elapsed_time = int((time.time() - start_time) * 1e6)  # Convert seconds to microseconds
        
        return unix_timestamp_ms, human_readable_utc, metrics, computed_active_power, computed_apparent_power, elapsed_time
    
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
    except (KeyError, IndexError) as e:
        print(f"Error parsing data: {e}")
    
    default_timestamp = int(time.time() * 1000)
    return default_timestamp, datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3], None, None, None, -1  # Default on error

# Function to save data to CSV
def save_to_csv(filename, unix_timestamp, human_readable_utc, metrics, computed_active_power, computed_apparent_power, elapsed_time):
    file_exists = os.path.isfile(filename)
    try:
        with open(filename, mode='a', newline='') as csvfile:
            writer = csv.writer(csvfile)
            
            if not file_exists:
                writer.writerow(["Unix Timestamp (ms)", "UTC Human-Readable", "Voltage (V)", "Current (A)", "Active Power (W)",
                                 "Computed Active Power (W) - Precise", "Frequency (Hz)", "Apparent Power (VA)", "Computed Apparent Power (VA)",
                                 "Power Factor (PF)", "Total Energy (Wh)", "Resettable Energy (Wh)", "Elapsed Time (µs)"])
            
            if metrics:
                writer.writerow([
                    unix_timestamp, human_readable_utc,
                    metrics["Voltage (V)"], metrics["Current (A)"], metrics["Active Power (W)"], computed_active_power,
                    metrics["Frequency (Hz)"], metrics["Apparent Power (VA)"], computed_apparent_power, metrics["Power Factor (PF)"],
                    metrics["Total Energy (Wh)"], metrics["Resettable Energy (Wh)"], elapsed_time
                ])
            else:
                writer.writerow([unix_timestamp, human_readable_utc] + ["TIMEOUT"] * 10 + [elapsed_time])
    except IOError as e:
        print(f"Error writing to CSV: {e}")

# Main function
def main():
    parser = argparse.ArgumentParser(description="Poll the device and save data to a CSV file.")
    parser.add_argument("--rate", type=float, default=1.0, help="Polling rate in seconds (default: 1 second).")
    parser.add_argument("--csv", type=str, required=True, help="Filename for the CSV output.")
    args = parser.parse_args()
    
    try:
        while True:
            unix_timestamp, human_readable_utc, metrics, computed_active_power, computed_apparent_power, elapsed_time = fetch_data(URL)
            
            if metrics:
                print(f"Unix Timestamp (ms): {unix_timestamp}")
                print(f"UTC Human-Readable: {human_readable_utc}")
                for metric, value in metrics.items():
                    print(f"{metric}: {value}")
                print(f"Computed Active Power (W) - Precise: {computed_active_power}")
                print(f"Computed Apparent Power (VA): {computed_apparent_power}")
                print(f"Elapsed Time: {elapsed_time} µs")
            else:
                print(f"Unix Timestamp (ms): {unix_timestamp} - Request Failed (Logged as TIMEOUT)")
                
            print("-" * 50)
            save_to_csv(args.csv, unix_timestamp, human_readable_utc, metrics, computed_active_power, computed_apparent_power, elapsed_time)
            time.sleep(args.rate)
    except KeyboardInterrupt:
        print("\nPolling stopped.")

if __name__ == "__main__":
    main()
