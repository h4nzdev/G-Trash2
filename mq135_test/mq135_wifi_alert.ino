/*
  =================================================================================
  G-TRASH MQ-135 Garbage-Area Air Quality Monitor & Telemetry
  =================================================================================
  Target Board : ESP32 DevKit
  Sensors      : MQ-135 Broad Gas-Response Sensor (GPIO 34)
  Actuators    : Green LED (GPIO 18), Orange LED (GPIO 17), Red LED (GPIO 2), Buzzer (GPIO 16)
  Operational  : Exactly 3 Levels: CLEAN, MODERATE, CRITICAL
  Serial Speed : 115200 Baud (Continuous 1-Second Output)
  Telemetry    : HTTPS POST every 60 Seconds to Officials Dashboard
  =================================================================================
  Important Research Note:
  The MQ-135 is utilized as a broad gas-response sensor for garbage-area air quality.
  Readings represent raw ADC values and operational classifications, not official AQI
  or validated single-gas concentration measurements.
  =================================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------------------------------
// Hardware Pin Definitions
// ---------------------------------------------------------------------------------
const int mqSensor  = 34; // MQ-135 Analog Input Pin
const int ledRed    = 2;  // Red LED Pin (CRITICAL)
const int ledOrange = 17; // Orange LED Pin (MODERATE)
const int ledGreen  = 18; // Green LED Pin (CLEAN)
const int buzzer    = 16; // Alert Buzzer Pin (CRITICAL only)

// ---------------------------------------------------------------------------------
// Network & Backend Configuration
// ---------------------------------------------------------------------------------
const char* WIFI_SSID     = "Converge_2.4GHz_FDxYYe"; // Wi-Fi SSID
const char* WIFI_PASSWORD = "PbcY7UbQ";             // Wi-Fi Password

// Render HTTPS Backend API URL
const char* SERVER_URL    = "https://g-trash2.onrender.com/api/iot/sensor-data";

// Sensor Metadata
const char* SENSOR_ID     = "SENSOR-001";
const char* LOCATION      = "2nd Street";
const char* BARANGAY      = "Apas";

// ---------------------------------------------------------------------------------
// Calibration & Threshold Configuration (Temporary Initial Calibration Values)
// Easily adjustable following field testing in garbage/waste environments
// ---------------------------------------------------------------------------------
int cleanThreshold    = 200; // Upper limit for CLEAN air (ADC)
int criticalThreshold = 400; // Lower limit for CRITICAL air (ADC)
const int HYSTERESIS  = 15;  // Hysteresis margin to prevent rapid switching (ADC)

int cleanAirBaseline  = 0;   // Measured baseline during clean-air calibration routine

// Operational Status Levels (Strictly 3 levels)
enum AirQualityLevel {
  STATUS_CLEAN,
  STATUS_MODERATE,
  STATUS_CRITICAL
};

AirQualityLevel currentStatus = STATUS_CLEAN;

// Timing Configuration
const unsigned long UPLOAD_INTERVAL_MS = 60000; // Telemetry upload interval (60s)
const unsigned long SERIAL_INTERVAL_MS = 1000;  // Serial monitor output interval (1s)

unsigned long lastUploadTime = 0;
unsigned long lastSerialTime = 0;

// ---------------------------------------------------------------------------------
// Helper: Convert AirQualityLevel Enum to String
// ---------------------------------------------------------------------------------
String getStatusString(AirQualityLevel level) {
  switch (level) {
    case STATUS_CRITICAL: return "CRITICAL";
    case STATUS_MODERATE: return "MODERATE";
    case STATUS_CLEAN:
    default:              return "CLEAN";
  }
}

// ---------------------------------------------------------------------------------
// Hardware Actuation (LEDs & Buzzer)
// ---------------------------------------------------------------------------------
void applyHardwareActuation(AirQualityLevel level) {
  switch (level) {
    case STATUS_CLEAN:
      digitalWrite(ledGreen, HIGH);
      digitalWrite(ledOrange, LOW);
      digitalWrite(ledRed, LOW);
      digitalWrite(buzzer, LOW);
      break;

    case STATUS_MODERATE:
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledOrange, HIGH);
      digitalWrite(ledRed, LOW);
      digitalWrite(buzzer, LOW);
      break;

    case STATUS_CRITICAL:
      digitalWrite(ledGreen, LOW);
      digitalWrite(ledOrange, LOW);
      digitalWrite(ledRed, HIGH);
      digitalWrite(buzzer, HIGH); // Only CRITICAL activates buzzer
      break;
  }
}

// ---------------------------------------------------------------------------------
// Read Smoothed Analog Value (Average of 20 samples to eliminate noise)
// ---------------------------------------------------------------------------------
int readSmoothedSensor() {
  long sum = 0;
  const int SAMPLES = 20;
  for (int i = 0; i < SAMPLES; i++) {
    sum += analogRead(mqSensor);
    delay(5);
  }
  return (int)(sum / SAMPLES);
}

// ---------------------------------------------------------------------------------
// Clean-Air Baseline Calibration Routine
// ---------------------------------------------------------------------------------
void calibrateCleanAirBaseline() {
  Serial.println("\n--------------------------------------------------");
  Serial.println("[CALIBRATION] Starting MQ-135 Clean-Air Baseline Calibration...");
  Serial.println("[CALIBRATION] Sampling clean-air reference points...");

  long sum = 0;
  const int CAL_SAMPLES = 30;
  for (int i = 0; i < CAL_SAMPLES; i++) {
    sum += analogRead(mqSensor);
    digitalWrite(ledGreen, !digitalRead(ledGreen)); // Blink Green LED during calibration
    delay(100);
    if ((i + 1) % 10 == 0) {
      Serial.printf("[CALIBRATION] Progress: %d/%d samples\n", i + 1, CAL_SAMPLES);
    }
  }

  cleanAirBaseline = (int)(sum / CAL_SAMPLES);
  digitalWrite(ledGreen, LOW);

  Serial.println("[CALIBRATION] Calibration Complete!");
  Serial.printf("[CALIBRATION] Established Clean-Air Baseline: %d ADC (%.2fV)\n",
                cleanAirBaseline, cleanAirBaseline * (3.3 / 4095.0));
  Serial.printf("[CALIBRATION] Operating Thresholds -> Clean: %d | Critical: %d | Hysteresis: +/-%d\n",
                cleanThreshold, criticalThreshold, HYSTERESIS);
  Serial.println("--------------------------------------------------\n");
}

// ---------------------------------------------------------------------------------
// Update Air Quality Classification with Hysteresis
// ---------------------------------------------------------------------------------
void updateClassification(int rawValue) {
  switch (currentStatus) {
    case STATUS_CLEAN:
      if (rawValue > (cleanThreshold + HYSTERESIS)) {
        if (rawValue > (criticalThreshold + HYSTERESIS)) {
          currentStatus = STATUS_CRITICAL;
        } else {
          currentStatus = STATUS_MODERATE;
        }
      }
      break;

    case STATUS_MODERATE:
      if (rawValue < (cleanThreshold - HYSTERESIS)) {
        currentStatus = STATUS_CLEAN;
      } else if (rawValue > (criticalThreshold + HYSTERESIS)) {
        currentStatus = STATUS_CRITICAL;
      }
      break;

    case STATUS_CRITICAL:
      if (rawValue < (criticalThreshold - HYSTERESIS)) {
        if (rawValue < (cleanThreshold - HYSTERESIS)) {
          currentStatus = STATUS_CLEAN;
        } else {
          currentStatus = STATUS_MODERATE;
        }
      }
      break;
  }

  applyHardwareActuation(currentStatus);
}

// ---------------------------------------------------------------------------------
// Connect / Maintain Wi-Fi Connection
// ---------------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    digitalWrite(ledOrange, !digitalRead(ledOrange)); // Blink Orange LED while connecting
    attempts++;
  }

  digitalWrite(ledOrange, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected Successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Will retry next cycle.");
  }
}

// ---------------------------------------------------------------------------------
// Transmit Telemetry Payload to Officials Dashboard Backend
// ---------------------------------------------------------------------------------
void uploadTelemetry() {
  connectWiFi();
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] Wi-Fi unavailable. Skipping upload.");
    return;
  }

  int rawValue = readSmoothedSensor();
  updateClassification(rawValue);
  String statusStr = getStatusString(currentStatus);

  // Construct JSON Payload matching G-TRASH backend schema
  StaticJsonDocument<512> doc;
  doc["sensorId"]          = SENSOR_ID;
  doc["deviceType"]        = "ESP32";
  doc["location"]          = LOCATION;
  doc["barangay"]          = BARANGAY;
  doc["rawValue"]          = rawValue;
  doc["airQuality"]        = statusStr;
  doc["cleanThreshold"]    = cleanThreshold;
  doc["criticalThreshold"] = criticalThreshold;
  doc["measurementType"]   = "MQ-135 garbage-area air-quality classification";
  doc["isOfficialAQI"]     = false;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("\n>>> [HTTP] Uploading Telemetry to Officials Dashboard <<<");
  Serial.println("  Payload: " + jsonPayload);

  WiFiClientSecure client;
  client.setInsecure(); // Skip SSL certificate verification for HTTPS Cloudflare/Render endpoints

  HTTPClient http;
  bool isHttps = String(SERVER_URL).startsWith("https");

  bool beginSuccess = false;
  if (isHttps) {
    beginSuccess = http.begin(client, SERVER_URL);
  } else {
    beginSuccess = http.begin(SERVER_URL);
  }

  if (beginSuccess) {
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(10000);

    int httpCode = http.POST(jsonPayload);

    if (httpCode > 0) {
      Serial.printf("[HTTP] Success! Server Response Code: %d\n", httpCode);
      String response = http.getString();
      Serial.printf("[HTTP] Response: %s\n", response.c_str());
    } else {
      Serial.printf("[HTTP] POST Failed! Error: %s\n", http.errorToString(httpCode).c_str());
    }
    http.end();
  } else {
    Serial.println("[HTTP] Failed to initiate connection to endpoint.");
  }
}

// ---------------------------------------------------------------------------------
// Setup Function
// ---------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  // Configure Actuator Pins
  pinMode(ledGreen, OUTPUT);
  pinMode(ledOrange, OUTPUT);
  pinMode(ledRed, OUTPUT);
  pinMode(buzzer, OUTPUT);

  digitalWrite(ledGreen, LOW);
  digitalWrite(ledOrange, LOW);
  digitalWrite(ledRed, LOW);
  digitalWrite(buzzer, LOW);

  Serial.println("\n==================================================");
  Serial.println(" G-TRASH MQ-135 Garbage-Area Air Monitor - ESP32");
  Serial.println(" Location: 2nd Street, Apas");
  Serial.println(" Operational Levels: CLEAN | MODERATE | CRITICAL");
  Serial.println(" Serial Stream: Every 1s | Telemetry Upload: Every 60s");
  Serial.println("==================================================");

  // Run initial Clean-Air Baseline Calibration
  calibrateCleanAirBaseline();

  // Initial sensor sample and state establishment
  int initialRaw = readSmoothedSensor();
  if (initialRaw > criticalThreshold) {
    currentStatus = STATUS_CRITICAL;
  } else if (initialRaw > cleanThreshold) {
    currentStatus = STATUS_MODERATE;
  } else {
    currentStatus = STATUS_CLEAN;
  }
  applyHardwareActuation(currentStatus);

  connectWiFi();

  // Upload initial telemetry reading upon boot
  uploadTelemetry();
  lastUploadTime = millis();
  lastSerialTime = millis();
}

// ---------------------------------------------------------------------------------
// Main Loop Function
// ---------------------------------------------------------------------------------
void loop() {
  unsigned long now = millis();

  // 1. Continuous Smoothed Measurement & Classification with Hysteresis
  int rawValue = readSmoothedSensor();
  updateClassification(rawValue);

  // 2. Serial Monitor Output Every 1 Second
  if (now - lastSerialTime >= SERIAL_INTERVAL_MS) {
    lastSerialTime = now;

    float voltage = rawValue * (3.3 / 4095.0);
    int secondsUntilUpload = (UPLOAD_INTERVAL_MS - (now - lastUploadTime)) / 1000;
    if (secondsUntilUpload < 0) secondsUntilUpload = 0;

    String statusStr = getStatusString(currentStatus);

    // Formatted Serial Monitor Output
    Serial.printf("Raw ADC: %4d | Voltage: %.2fV | Status: %-8s | Clean: %d | Critical: %d | Next Upload: %2ds\n",
                  rawValue, voltage, statusStr.c_str(), cleanThreshold, criticalThreshold, secondsUntilUpload);
  }

  // 3. Periodic Telemetry Upload to Officials Dashboard (Every 60 Seconds)
  if (now - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = now;
    uploadTelemetry();
  }

  delay(20); // Responsive loop delay
}
