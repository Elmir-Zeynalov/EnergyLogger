import asyncio
import time
from pymodbus.client import AsyncModbusTcpClient


# Modbus TCP Server Address
ADDR = "192.168.0.2"
PORT = 502

# Sensor Addresses (Same as in Rust Code)
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
    RESIDUAL_CURRENT_TYPE_A = 0x42A
    NEUTRAL_CURRENT = 0x42C

# Sensors to Read
SENSOR_ARRAY = [
    LineInEnergySensor.POWER_ACTIVE,
    LineInEnergySensor.VOLTAGE,
    LineInEnergySensor.CURRENT,
    LineInEnergySensor.FREQUENCY,
    LineInEnergySensor.POWER_FACTOR,
]

# Initialize Sensor Data Structure
def init_sensor_data():
    return {
        "power_active": 0,
        "voltage": 0,
        "current": 0,
        "frequency": 0,
        "power_factor": 0.0,
    }

async def read_modbus_data():
    client = AsyncModbusTcpClient(ADDR, port=PORT)
    await client.connect()

    while True:
        start_time = time.time()
        sensor_data = init_sensor_data()

        if not client.connected:
            print("Failed to connect to Modbus server")
            await asyncio.sleep(1)  # Retry in 1 second
            continue

        for sensor_type in SENSOR_ARRAY:
            try:
                response = await client.read_input_registers(sensor_type, count=2)
                if response.isError():
                    print(f"Error reading register {sensor_type}: {response}")
                    continue

                registers = response.registers
                raw_value = (int(registers[0]) << 16) | int(registers[1])
                
                if sensor_type == LineInEnergySensor.POWER_ACTIVE:
                    sensor_data["power_active"] = raw_value
                elif sensor_type == LineInEnergySensor.VOLTAGE:
                    sensor_data["voltage"] = raw_value  # Treat voltage as integer
                elif sensor_type == LineInEnergySensor.CURRENT:
                    sensor_data["current"] = raw_value
                elif sensor_type == LineInEnergySensor.FREQUENCY:
                    sensor_data["frequency"] = raw_value / 100.0  # Assuming frequency needs decimal precision
                elif sensor_type == LineInEnergySensor.POWER_FACTOR:
                    sensor_data["power_factor"] = raw_value / 1000.0
            except Exception as e:
                print(f"Exception while reading registers: {e}")

        elapsed_time = (time.time() - start_time) * 1e6  # Convert to microseconds
        timestamp = int(time.time() * 1000)  # Milliseconds since epoch
        power = sensor_data["voltage"] * (sensor_data["current"] / 1000.0) * sensor_data["power_factor"]

        print(f"{timestamp} ms since epoch, Readings: ({sensor_data['voltage']}V  / {sensor_data['current']/1000.0}A / {sensor_data['power_factor']}PF / {sensor_data['frequency']:.2f}Hz / {sensor_data['power_active']}W), Computed Power: {power:.2f}W, Time taken: {elapsed_time:.2f} µs")

        await asyncio.sleep(0.01)  # 10ms delay

    await client.close()

if __name__ == "__main__":
    asyncio.run(read_modbus_data())