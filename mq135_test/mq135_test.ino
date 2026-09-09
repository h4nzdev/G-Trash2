/*
  =============================================================
  MQ-135 Air Quality Sensor Simple Local Test Sketch for ESP32
  =============================================================
  
  Wiring Setup:
    - MQ-135 AO  -> ESP32 Pin 34 (GPIO 34)
    - Red LED    -> ESP32 Pin 2  (GPIO 2)
    - Buzzer     -> ESP32 Pin 16 (GPIO 16)
    - MQ-135 VCC -> ESP32 5V or 3.3V
    - MQ-135 GND -> ESP32 GND

  Serial Monitor Speed: 115200 baud
*/

const int mqSensor = 34; // MQ-135 Analog Input Pin
const int ledRed   = 2;  // Red Alert LED Pin
const int buzzer   = 16; // Alert Buzzer Pin

void setup() {
  Serial.begin(115200);
  delay(1000);

  pinMode(buzzer, OUTPUT);
  pinMode(ledRed, OUTPUT);

  digitalWrite(ledRed, LOW);
  digitalWrite(buzzer, LOW);

  Serial.println("\n-------------------------------------------");
  Serial.println("       MQ-135 ESP32 Local Test Starting");
  Serial.println("-------------------------------------------");
  Serial.println("Reading analog values every second...");
}

void loop() {
  // Read the raw 12-bit analog value (0 - 4095 on ESP32)
  int digitalNumber = analogRead(mqSensor);

  // Calculate voltage (0.0V - 3.3V)
  float voltage = digitalNumber * (3.3 / 4095.0);

  Serial.print("Raw Analog Value: ");
  Serial.print(digitalNumber);
  Serial.print("\t | Voltage: ");
  Serial.print(voltage, 2);
  Serial.print(" V");

  // Threshold check (> 700)
  if (digitalNumber > 700) {
    digitalWrite(ledRed, HIGH);
    digitalWrite(buzzer, HIGH);
    Serial.println("\t | STATUS: ALERT (> 700 - Poor Air Quality!)");
  } else {
    digitalWrite(ledRed, LOW);
    digitalWrite(buzzer, LOW);
    Serial.println("\t | STATUS: NORMAL");
  }

  delay(1000);
}
