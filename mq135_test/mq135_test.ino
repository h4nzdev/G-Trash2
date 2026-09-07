/*
  =============================================================
  MQ-135 Gas Sensor Simple Test Sketch for ESP32
  =============================================================
  
  Wiring Setup:
    - MQ-135 AO  -> ESP32 Pin D34 (GPIO 34)
    - MQ-135 VCC -> ESP32 3V / 3.3V
    - MQ-135 GND -> ESP32 GND

  Serial Monitor Speed: 115200 baud
*/

// Define the analog input pin connected to MQ-135 AO
const int MQ135_PIN = 34;

void setup() {
  // Start serial communication with computer
  Serial.begin(115200);
  delay(1000); // Brief delay to stabilize serial connection

  Serial.println("\n-------------------------------------------");
  Serial.println("       MQ-135 ESP32 Test Starting");
  Serial.println("-------------------------------------------");
  Serial.println("Sensor warming up... Reading values every second.");
}

void loop() {
  // Read the raw 12-bit analog value (0 - 4095 on ESP32)
  int rawAnalogValue = analogRead(MQ135_PIN);

  // Calculate approximate voltage (0.0V - 3.3V)
  float voltage = rawAnalogValue * (3.3 / 4095.0);

  // Print results to Serial Monitor
  Serial.print("Raw Analog Value: ");
  Serial.print(rawAnalogValue);
  Serial.print("\t |  Voltage: ");
  Serial.print(voltage, 2);
  Serial.println(" V");

  // Wait 1 second before next reading
  delay(1000);
}
