/*
  =================================================================================
  G-TRASH MQ-135 Air Quality Monitor & Officials Dashboard Telemetry
  =================================================================================
  Target Board : ESP32 DevKit
  Sensors      : MQ-135 Air Quality Sensor (GPIO 34)
  Actuators    : Red LED (GPIO 2), Buzzer (GPIO 16)
  Serial Speed : 115200 Baud (Continuous 1-Second Output)
  Telemetry    : HTTPS POST every 60 Seconds to Officials Dashboard
  =================================================================================
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>

// ---------------------------------------------------------------------------------
// Hardware Pin Definitions
// ---------------------------------------------------------------------------------
const int mqSensor = 34; // MQ-135 Analog Input Pin
const int ledRed   = 2;  // Red Alert LED Pin
const int buzzer   = 16; // Alert Buzzer Pin

// ---------------------------------------------------------------------------------
// Network & Backend Configuration
// ---------------------------------------------------------------------------------
const char* WIFI_SSID     = "Converge_2.4GHz_FDxYYe"; // Wi-Fi SSID
const char* WIFI_PASSWORD = "PbcY7UbQ";             // Wi-Fi Password

// Render HTTPS Backend API URL (or local HTTP e.g. "http://192.168.1.X:5000/api/iot/sensor-data")
const char* SERVER_URL    = "https://g-trash2.onrender.com/api/iot/sensor-data";

// Sensor Metadata
const char* SENSOR_ID     = "SENSOR-001";
const char* LOCATION      = "2nd Street";
const char* BARANGAY      = "Apas";

// Threshold & Timing Configuration
const int RAW_ALERT_THRESHOLD  = 700;   // Threshold for LED & Buzzer alarm (>700 ADC)
const unsigned long UPLOAD_INTERVAL_MS = 60000; // Telemetry upload interval (60s)
const unsigned long SERIAL_INTERVAL_MS = 1000;  // Serial monitor output interval (1s)

unsigned long lastUploadTime = 0;
unsigned long lastSerialTime = 0;

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
    digitalWrite(ledRed, !digitalRead(ledRed)); // Blink LED while connecting
    attempts++;
  }

  digitalWrite(ledRed, LOW);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected Successfully!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Will retry next loop.");
  }
}

// ---------------------------------------------------------------------------------
// Read Smoothed Analog Value (Average 10 samples to eliminate electrical noise)
// ---------------------------------------------------------------------------------
int readSmoothedSensor() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(mqSensor);
    delay(5);
  }
  return (int)(sum / 10);
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
  String airQuality = (rawValue > RAW_ALERT_THRESHOLD) ? "Unhealthy" : (rawValue > 400 ? "Moderate" : "Good");
  float estimatedPpm = (rawValue > RAW_ALERT_THRESHOLD) ? 35.0 : (rawValue > 400 ? 18.0 : 8.0);

  // Construct JSON Payload matching G-TRASH backend schema
  StaticJsonDocument<512> doc;
  doc["sensorId"]   = SENSOR_ID;
  doc["deviceType"] = "ESP32";
  doc["location"]   = LOCATION;
  doc["barangay"]   = BARANGAY;
  doc["rawValue"]   = rawValue;
  doc["ammonia"]    = estimatedPpm;
  doc["airQuality"] = airQuality;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("\n>>> [HTTP] Uploading Telemetry to Officials Dashboard <<<");
  Serial.println("  Payload: " + jsonPayload);

  // Keep WiFiClientSecure object alive during HTTPClient request lifecycle
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

  pinMode(ledRed, OUTPUT);
  pinMode(buzzer, OUTPUT);

  digitalWrite(ledRed, LOW);
  digitalWrite(buzzer, LOW);

  Serial.println("\n==================================================");
  Serial.println(" G-TRASH MQ-135 Air Quality Monitor - ESP32 Boot");
  Serial.println(" Location: 2nd Street, Apas");
  Serial.println(" Serial Stream: Every 1s | Telemetry Upload: Every 60s");
  Serial.println("==================================================");

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
  int rawValue = analogRead(mqSensor);

  // 1. Instant Continuous Local Hardware Alarm Check (> 700 ADC)
  if (rawValue > RAW_ALERT_THRESHOLD) {
    digitalWrite(ledRed, HIGH);
    digitalWrite(buzzer, HIGH);
  } else {
    digitalWrite(ledRed, LOW);
    digitalWrite(buzzer, LOW);
  }

  // 2. Serial Monitor Output Every 1 Second
  if (now - lastSerialTime >= SERIAL_INTERVAL_MS) {
    lastSerialTime = now;

    float voltage = rawValue * (3.3 / 4095.0);
    int secondsUntilUpload = (UPLOAD_INTERVAL_MS - (now - lastUploadTime)) / 1000;
    if (secondsUntilUpload < 0) secondsUntilUpload = 0;

    String statusStr;
    if (rawValue > RAW_ALERT_THRESHOLD) {
      statusStr = "ALERT (>700) - Poor Air Quality";
    } else if (rawValue > 400) {
      statusStr = "WARNING (400-700) - Moderate";
    } else {
      statusStr = "NORMAL - Clean Air";
    }

    Serial.printf("Raw ADC: %4d | Voltage: %.2fV | Status: %-30s | Next Upload: %2ds\n",
                  rawValue, voltage, statusStr.c_str(), secondsUntilUpload);
  }

  // 3. Periodic Telemetry Upload to Officials Dashboard (Every 60 Seconds)
  if (now - lastUploadTime >= UPLOAD_INTERVAL_MS) {
    lastUploadTime = now;
    uploadTelemetry();
  }

  delay(50); // Fast responsive loop delay
}
