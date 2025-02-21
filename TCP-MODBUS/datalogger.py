import asyncio
import time
import argparse
from pymodbus.client import AsyncModbusTcpClient
import csv_logger  # Import the new module

# Parse command-line arguments for CSV filename
parser = argparse.ArgumentParser(description="Modbus Data Logger")
parser.add_argument("--csv", type=str, required=True, help="CSV file to store data")
args = parser.parse_args()
csv_file = args.csv

# Initialize the CSV file
csv_logger.init_csv(csv_file)



# Modbus TCP Server Address
ADDR = "192.168.0.2"
PORT = 502

# Sensor Addresses
class LineInEnergySensor:
    ABSOLUTE_ACTIVE_ENERGY = 0x400
    POWER_ACTIVE = 0x402
    VOLTAGE = 0x404
    CURRENT = 0x406
    FREQUENCY = 0x408
    POWER_FACTOR = 0x40A
    POWER_APPARENT = 0x40E
    POWER_REACTIVE = 0x410
    ABSOLUTE_ACTIVE_ENERGY_RESETTABLE = 0x412
    ABSOLUTE_REACTIVE_ENERGY = 0x414
    ABSOLUTE_REACTIVE_ENERGY_RESETTABLE = 0x416
    FORWARD_ACTIVE_ENERGY = 0x41A
    FORWARD_REACTIVE_ENERGY = 0x41C
    FORWARD_ACTIVE_ENERGY_RESETTABLE = 0x41E
    FORWARD_REACTIVE_ENERGY_RESETTABLE = 0x420
    REVERSE_ACTIVE_ENERGY = 0x422
    REVERSE_REACTIVE_ENERGY = 0x424
    REVERSE_ACTIVE_ENERGY_RESETTABLE = 0x426
    REVERSE_REACTIVE_ENERGY_RESETTABLE = 0x428

# Sensors to Read
SENSOR_ARRAY = [
    LineInEnergySensor.POWER_ACTIVE,
    LineInEnergySensor.VOLTAGE,
    LineInEnergySensor.CURRENT,
    LineInEnergySensor.FREQUENCY,
    LineInEnergySensor.POWER_FACTOR,
    LineInEnergySensor.POWER_APPARENT,
    LineInEnergySensor.POWER_REACTIVE,
    LineInEnergySensor.ABSOLUTE_ACTIVE_ENERGY,
    LineInEnergySensor.ABSOLUTE_ACTIVE_ENERGY_RESETTABLE,
    LineInEnergySensor.FORWARD_ACTIVE_ENERGY,
    LineInEnergySensor.FORWARD_REACTIVE_ENERGY,
    LineInEnergySensor.REVERSE_ACTIVE_ENERGY,
    LineInEnergySensor.REVERSE_REACTIVE_ENERGY
]

# Initialize Sensor Data Structure
def init_sensor_data():
    return {
        "power_active": 0,
        "voltage": 0,  # No scaling needed
        "current": 0.0,
        "frequency": 0.0,
        "power_factor": 0.0,
        "power_apparent": 0,
        "power_reactive": 0,
        "absolute_active_energy": 0,
        "absolute_active_energy_resettable": 0,
        "forward_active_energy": 0,
        "forward_reactive_energy": 0,
        "reverse_active_energy": 0,
        "reverse_reactive_energy": 0
    }

async def read_modbus_data():
    client = AsyncModbusTcpClient(ADDR, port=PORT)
    await client.connect()

    while True:
        start_time = time.time()
        sensor_data = init_sensor_data()

        if not client.connected:
            print("Failed to connect to Modbus server")
            await asyncio.sleep(1)
            continue

        for sensor_type in SENSOR_ARRAY:
            try:
                response = await client.read_input_registers(sensor_type, count=2)
                
                if response.isError():
                    print(f"Skipping register {hex(sensor_type)}: {response}")
                    continue

                registers = response.registers
                raw_value = (int(registers[0]) << 16) | int(registers[1])

                if sensor_type == LineInEnergySensor.POWER_ACTIVE:
                    sensor_data["power_active"] = raw_value
                elif sensor_type == LineInEnergySensor.VOLTAGE:
                    sensor_data["voltage"] = raw_value  # No scaling needed
                elif sensor_type == LineInEnergySensor.CURRENT:
                    sensor_data["current"] = raw_value / 1000.0  # Convert mA to A
                elif sensor_type == LineInEnergySensor.FREQUENCY:
                    sensor_data["frequency"] = raw_value / 100.0  # Convert to Hz
                elif sensor_type == LineInEnergySensor.POWER_FACTOR:
                    sensor_data["power_factor"] = raw_value / 1000.0  # Correct PF scaling
                elif sensor_type == LineInEnergySensor.POWER_APPARENT:
                    sensor_data["power_apparent"] = raw_value
                elif sensor_type == LineInEnergySensor.POWER_REACTIVE:
                    sensor_data["power_reactive"] = raw_value
                elif sensor_type == LineInEnergySensor.ABSOLUTE_ACTIVE_ENERGY:
                    sensor_data["absolute_active_energy"] = raw_value
                elif sensor_type == LineInEnergySensor.ABSOLUTE_ACTIVE_ENERGY_RESETTABLE:
                    sensor_data["absolute_active_energy_resettable"] = raw_value
                elif sensor_type == LineInEnergySensor.FORWARD_ACTIVE_ENERGY:
                    sensor_data["forward_active_energy"] = raw_value
                elif sensor_type == LineInEnergySensor.FORWARD_REACTIVE_ENERGY:
                    sensor_data["forward_reactive_energy"] = raw_value
                elif sensor_type == LineInEnergySensor.REVERSE_ACTIVE_ENERGY:
                    sensor_data["reverse_active_energy"] = raw_value
                elif sensor_type == LineInEnergySensor.REVERSE_REACTIVE_ENERGY:
                    sensor_data["reverse_reactive_energy"] = raw_value
            except Exception as e:
                print(f"Exception while reading register {hex(sensor_type)}: {e}")

        elapsed_time = (time.time() - start_time) * 1e6
        timestamp = int(time.time() * 1000)

        # Compute Power: P = V * I * PF
        computed_power = round(sensor_data["voltage"] * sensor_data["current"] * sensor_data["power_factor"], 3)

        print(
            f"{timestamp} ms | "
            f"Voltage: {sensor_data['voltage']}V | "
            f"Current: {sensor_data['current']:.3f}A | "
             f"Active Power (Modbus): {sensor_data['power_active']}W | "
            f"Computed Power: {computed_power}W | "
            f"Frequency: {sensor_data['frequency']:.2f}Hz | "
            f"PF: {sensor_data['power_factor']:.3f} | "  # Now correctly scaled
            f"Apparent Power: {sensor_data['power_apparent']}VA | "
            f"Energy: {sensor_data['absolute_active_energy']}Wh | "
            f"Resettable Energy: {sensor_data['absolute_active_energy_resettable']}Wh | "
            f"Time taken: {elapsed_time:.2f} µs"
        )


        # Log data to CSV
        csv_logger.log_to_csv(csv_file, [
            timestamp,
            sensor_data["voltage"], sensor_data["current"], sensor_data["power_active"], computed_power, sensor_data["frequency"],
            sensor_data["power_apparent"], sensor_data["power_factor"],
            sensor_data["absolute_active_energy"], sensor_data["absolute_active_energy_resettable"],
            elapsed_time
        ])

        await asyncio.sleep(0.01)

    await client.close()

if __name__ == "__main__":
    asyncio.run(read_modbus_data())
