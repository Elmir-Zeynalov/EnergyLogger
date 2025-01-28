import requests
import time
import argparse
import csv
import os

URL = "http://192.168.0.2/statusjsn.js?components=1073741823"

# Function to fetch data from the device
def fetch_data(url):
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()  # Raise exception for HTTP errors

        # Parse JSON response
        data = response.json()

        # Extract UTC timestamp
        utc_timestamp = data.get("clock", {}).get("systemtime", {})
        formatted_utc_time = (
            f"{utc_timestamp.get('day'):02d}-{utc_timestamp.get('month'):02d}-{utc_timestamp.get('year')} "
            f"{utc_timestamp.get('hour'):02d}:{utc_timestamp.get('minute'):02d}:{utc_timestamp.get('second'):02d}"
        )

        # Extract metrics
        sensor_values = data.get("sensor_values", [])[0].get("values", [])[0]
        metrics = {
            "Voltage (V)": sensor_values[0]["v"],
            "Current (A)": sensor_values[1]["v"],
            "Frequency (Hz)": sensor_values[2]["v"],
            "Phase (deg)": sensor_values[3]["v"],
            "Active Power (W)": sensor_values[4]["v"],
            "Reactive Power (VAR)": sensor_values[5]["v"],
            "Apparent Power (VA)": sensor_values[6]["v"],
            "Power Factor (PF)": sensor_values[7]["v"],
            "Total Energy (kWh)": sensor_values[8]["v"],
            "Resettable Energy (kWh)": sensor_values[9]["v"],
        }

        return formatted_utc_time, metrics

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data: {e}")
    except (KeyError, IndexError) as e:
        print(f"Error parsing data: {e}")

    return None, None

# Function to save data to CSV
def save_to_csv(filename, timestamp, metrics):
    file_exists = os.path.isfile(filename)
    try:
        with open(filename, mode='a', newline='') as csvfile:
            writer = csv.writer(csvfile)
            
            if not file_exists:
                writer.writerow(["Timestamp"] + list(metrics.keys()))
            
            writer.writerow([timestamp] + list(metrics.values()))
    except IOError as e:
        print(f"Error writing to CSV: {e}")

# Main function
def main():
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Poll the device and save data to a CSV file.")
    parser.add_argument("--rate", type=float, default=1.0, help="Polling rate in seconds (default: 1 second).")
    parser.add_argument("--csv", type=str, required=True, help="Filename for the CSV output.")
    args = parser.parse_args()

    # Polling loop
    try:
        while True:
            timestamp, metrics = fetch_data(URL) 
            if timestamp and metrics:
                print(f"Timestamp: {timestamp}")
                for metric, value in metrics.items():
                    print(f"{metric}: {value}")
                print("-" * 50)
                # Save to CSV
                save_to_csv(args.csv, timestamp, metrics)
            time.sleep(args.rate) 
    except KeyboardInterrupt:
        print("\nPolling stopped.")

if __name__ == "__main__":
    main()
