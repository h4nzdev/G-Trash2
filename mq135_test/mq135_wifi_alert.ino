/*
  =================================================================================
  G-TRASH MQ-135 Air Quality Sensor & Wi-Fi Alert Sketch (Render Backend)
  =================================================================================
  Target Board : ESP32 or ESP8266 NodeMCU
  Sensor       : MQ-135 Gas / Air Quality Sensor
  Interval     : 1 Minute (60,000 ms)
  Backend URL  : https://g-trash2.onrender.com/api/iot/sensor-data
  
  Wi-Fi Credentials:
    - SSID     : Converge_2.4GHz_FDxYYe
    - Password : PbcY7UbQ

  Hardware Setup (Breadboard):
    - MQ-135 VCC  -> ESP 5V (or 3.3V)
    - MQ-135 GND  -> ESP GND
    - MQ-135 AO   -> ESP Analog Input (GPIO 13 / D13 on ESP32, A0 on ESP8266)
  =================================================================================
*/

#if defined(ESP32)
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
  #define ANALOG_PIN 13    // GPIO 13 (D13) on ESP32
  #define MAX_ADC 4095.0
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <ESP8266HTTPClient.h>
  #include <WiFiClientSecure.h>
  #define ANALOG_PIN A0    // Pin A0 on ESP8266
  #define MAX_ADC 1023.0
#else
  #include <WiFi.h>
  #include <HTTPClient.h>
  #include <WiFiClientSecure.h>
  #define ANALOG_PIN 13    // GPIO 13 (D13)
  #define MAX_ADC 4095.0
#endif

// ---------------------------------------------------------------------------------
// Wi-Fi & Render Backend Configuration
// ---------------------------------------------------------------------------------
const char* WIFI_SSID     = "Converge_2.4GHz_FDxYYe";
const char* WIFI_PASSWORD = "PbcY7UbQ";

// Render Backend API URL
const char* SERVER_URL    = "https://g-trash2.onrender.com/api/iot/sensor-data";

// Sensor Metadata (Ensure sensorId matches registered sensor in admin dashboard)
const char* SENSOR_ID     = "SENSOR-001";
const char* LOCATION      = "Barangay Station";
const char* BARANGAY      = "Lahug";

// Timing Interval (1 minute = 60,000 ms)
const unsigned long INTERVAL_MS = 60000;
unsigned long lastSendTime = 0;

// Threshold for Air Quality (Adjust based on sensor calibration)
const int RAW_THRESHOLD = 500; 

// ---------------------------------------------------------------------------------
// Connect to Wi-Fi
// ---------------------------------------------------------------------------------
void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.print("[WiFi] Connecting to ");
  Serial.print(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] Connection Failed! Will retry next loop.");
  }
}

// ---------------------------------------------------------------------------------
// Read Sensor & Send Data to Render Dashboard
// ---------------------------------------------------------------------------------
void readAndSendData() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[HTTP] Error: Wi-Fi not connected. Skipping upload.");
      return;
    }
  }

  // 1. Read MQ-135 analog sensor value
  int rawValue = analogRead(ANALOG_PIN);
  float voltage = rawValue * (3.3 / MAX_ADC);

  // Approximate Ammonia (NH3) ppm calculation for dashboard mapping
  float estimatedPpm = (rawValue / MAX_ADC) * 60.0;

  // 2. Finalize status: Clean vs Not Clean
  bool isClean = (rawValue < RAW_THRESHOLD);
  const char* statusStr = isClean ? "CLEAN" : "NOT CLEAN (AIR QUALITY ALERT)";

  Serial.println("\n------------------------------------------------");
  Serial.print("MQ-135 Raw Reading : "); Serial.println(rawValue);
  Serial.print("Calculated Voltage  : "); Serial.print(voltage, 2); Serial.println(" V");
  Serial.print("Estimated Ammonia   : "); Serial.print(estimatedPpm, 1); Serial.println(" ppm");
  Serial.print("Air Quality Status  : "); Serial.println(statusStr);
  Serial.println("------------------------------------------------");

  // 3. Construct JSON Payload
  String jsonPayload = "{";
  jsonPayload += "\"sensorId\":\"" + String(SENSOR_ID) + "\",";
  jsonPayload += "\"deviceType\":\"ESP\",";
  jsonPayload += "\"location\":\"" + String(LOCATION) + "\",";
  jsonPayload += "\"barangay\":\"" + String(BARANGAY) + "\",";
  jsonPayload += "\"rawValue\":" + String(rawValue) + ",";
  jsonPayload += "\"ammonia\":" + String(estimatedPpm, 1) + ",";
  jsonPayload += "\"airQuality\":\"" + String(isClean ? "Good" : "Unhealthy") + "\"";
  jsonPayload += "}";

  // 4. Send HTTPS POST request to Render Backend API
  Serial.print("[HTTP] Uploading data to Render: ");
  Serial.println(SERVER_URL);

  WiFiClientSecure client;
  client.setInsecure(); // Skip SSL certificate verification for HTTPS request

  HTTPClient http;
  http.begin(client, SERVER_URL);

  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.print("[HTTP] Success! Server Response Code: ");
    Serial.println(httpResponseCode);
    String response = http.getString();
    Serial.print("[HTTP] Response: ");
    Serial.println(response);
  } else {
    Serial.print("[HTTP] Request Failed. Error Code: ");
    Serial.println(httpResponseCode);
  }

  http.end();
}

// ---------------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n==================================================");
  Serial.println("  MQ-135 Air Quality Monitor - G-TRASH (Render)");
  Serial.println("==================================================");

  connectWiFi();

  // Send first reading immediately upon boot
  readAndSendData();
  lastSendTime = millis();
}

// ---------------------------------------------------------------------------------
// Main Loop (1 Minute Interval)
// ---------------------------------------------------------------------------------
void loop() {
  unsigned long currentMillis = millis();

  // Check if 1 minute (60,000 ms) has passed
  if (currentMillis - lastSendTime >= INTERVAL_MS) {
    lastSendTime = currentMillis;
    readAndSendData();
  }
}
