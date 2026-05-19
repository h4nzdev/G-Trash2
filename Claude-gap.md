#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ===================== IR SENSOR =====================
const int irSensorPin = 18;

// ===================== LED PINS =====================
const int greenLed = 19;
const int redLed = 21;

// ===================== WIFI =====================
const char* WIFI_SSID = "ALPHA8_2.4";
const char* WIFI_PASSWORD = "Cocogingerberry14";

// ===================== BACKEND =====================
const char* SERVER_URL = "https://g-trash2.onrender.com/api/iot/sensor-data";

// ===================== VARIABLES =====================
bool detected = false;

// ===================== WIFI CONNECT =====================
void connectWiFi() {

  Serial.println("Connecting to WiFi...");

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

// ===================== SEND DATA =====================
void sendToBackend(bool objectDetected) { 

  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  StaticJsonDocument<300> doc;

  doc["sensorId"] = "IR-SENSOR-001";
  doc["deviceType"] = "ESP32";
  doc["location"] = "Test Area";
  doc["barangay"] = "Test Barangay";

  // GOOD AREA
  if (objectDetected == false) {

    doc["ammonia"] = 5;
    doc["methane"] = 0.2;
    doc["hydrogen"] = 3;
    doc["co2"] = 300;
    doc["binLevel"] = 10;
  }

  // DIRTY / DETECTED
  else {

    doc["ammonia"] = 40;
    doc["methane"] = 3;
    doc["hydrogen"] = 20;
    doc["co2"] = 1200;
    doc["binLevel"] = 90;
  }

  doc["temperature"] = 28;
  doc["humidity"] = 60;

  String payload;
  serializeJson(doc, payload);

  Serial.println("\nSending Data:");
  Serial.println(payload);

  HTTPClient http;

  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");

  int httpCode = http.POST(payload);

  Serial.print("HTTP Response: ");
  Serial.println(httpCode);

  String response = http.getString();

  Serial.println("Server Response:");
  Serial.println(response);

  http.end();
}

// ===================== SETUP =====================
void setup() {

  Serial.begin(115200);

  pinMode(irSensorPin, INPUT);

  pinMode(greenLed, OUTPUT);
  pinMode(redLed, OUTPUT);

  connectWiFi();
}

// ===================== LOOP =====================
void loop() {

  int irValue = digitalRead(irSensorPin);

  Serial.print("IR Value: ");
  Serial.println(irValue);

  // ===================== OBJECT DETECTED =====================
  if (irValue == 0 && detected == false) {

    detected = true;

    Serial.println("OBJECT DETECTED!");

    // RED LIGHT
    digitalWrite(redLed, HIGH);
    digitalWrite(greenLed, LOW);

    // SEND BAD STATUS
    sendToBackend(true);

    delay(1000);
  }

  // ===================== NO OBJECT =====================
  if (irValue == 1 && detected == true) {

    detected = false;

    Serial.println("AREA CLEAN");

    // GREEN LIGHT
    digitalWrite(redLed, LOW);
    digitalWrite(greenLed, HIGH);

    // SEND GOOD STATUS
    sendToBackend(false);

    delay(1000);
  }

  delay(200);
}