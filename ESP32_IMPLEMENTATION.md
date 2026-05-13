# G-TRASH ESP32 Implementation Guide
## Phase 1: Button Simulator (No Gas Sensor Required)

> **Current Phase:** Button simulates sensor readings across 4 air quality modes.  
> **Next Phase:** Replace button logic with MQ-135 + DHT11 + Ultrasonic readings (see Migration section).

---

## 1. How It Works

Each press of the BOOT button cycles the ESP32 through 4 pre-defined sensor modes and immediately sends a reading to the backend via `POST /api/iot/sensor-data`.

```
[Button Press] → Cycle Mode → Build JSON Payload → POST /api/iot/sensor-data
                                                          ↓
                                              Backend auto-processes:
                                              1. Saves SensorReading to DB
                                              2. Generates IoT alerts if thresholds exceeded
                                              3. Creates auto-Report if Unhealthy/Hazardous
                                              4. Upserts GarbageArea heatmap node
                                              5. Emits real-time Socket.io events
```

---

## 2. Hardware Required

| Component | Purpose | Qty |
|---|---|---|
| ESP32 DevKit v1 (30-pin or 38-pin) | Main microcontroller | 1 |
| USB Micro-B cable | Power + serial programming | 1 |
| PC with Arduino IDE | Upload firmware | 1 |

> The BOOT button (GPIO0) and built-in LED (GPIO2) are already on the ESP32 board — no external components needed for Phase 1.

---

## 3. Wiring Diagram

```
ESP32 DevKit (Top View)
┌─────────────────────────────┐
│  [USB]                      │
│                             │
│  3V3  [ ]          [ ] GND  │
│  EN   [ ]          [ ] GPIO23│
│  GPIO36[ ]         [ ] GPIO22│
│  GPIO39[ ]         [ ] GPIO1 │
│  GPIO34[ ]         [ ] GPIO3 │
│  GPIO35[ ]         [ ] GPIO21│
│  GPIO32[ ]         [ ] GND  │
│  GPIO33[ ]         [ ] GPIO19│
│  GPIO25[ ]         [ ] GPIO18│
│  GPIO26[ ]         [ ] GPIO5 │
│  GPIO27[ ]         [ ] GPIO17│
│  GPIO14[ ]         [ ] GPIO16│
│  GPIO12[ ]         [ ] GPIO4 │
│  GND  [ ]          [ ] GPIO0 ← BOOT BUTTON (press to simulate)
│  GPIO13[ ]         [ ] GPIO2 ← BUILT-IN LED (blinks feedback)
│  GPIO9 [ ]         [ ] GPIO15│
│  GPIO10[ ]         [ ] GPIO8 │
│  GPIO11[ ]         [ ] GPIO7 │
│  VIN  [ ]          [ ] GPIO6 │
└─────────────────────────────┘

Phase 1: No external wiring needed.
BOOT button = GPIO0 (active LOW, built-in pull-up)
LED         = GPIO2 (active HIGH on most boards)
```

---

## 4. Arduino IDE Setup

### 4.1 Install ESP32 Board Package

1. Open Arduino IDE → **File → Preferences**
2. Add to **Additional Boards Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Go to **Tools → Board → Boards Manager** → search `esp32` → install **esp32 by Espressif Systems**

### 4.2 Select Board

**Tools → Board → ESP32 Arduino → ESP32 Dev Module**

| Setting | Value |
|---|---|
| Board | ESP32 Dev Module |
| Upload Speed | 921600 |
| CPU Frequency | 240MHz |
| Flash Mode | QIO |
| Flash Size | 4MB |
| Port | COMx (check Device Manager) |

### 4.3 Install Required Libraries

Go to **Sketch → Include Library → Manage Libraries**, then install:

| Library | Author | Version |
|---|---|---|
| ArduinoJson | Benoit Blanchon | 6.x or 7.x |

> `WiFi.h` and `HTTPClient.h` are bundled with the ESP32 Arduino core — no separate install needed.

---

## 5. Configuration

Before uploading, edit the **CONFIGURATION** block at the top of the sketch:

```cpp
// WiFi
const char* WIFI_SSID     = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend — use your PC's local IP (NOT localhost)
// Find it: Windows → ipconfig | Mac/Linux → ifconfig
const char* SERVER_URL = "http://192.168.1.X:5000/api/iot/sensor-data";

// Sensor identity
const char* SENSOR_ID  = "SENSOR-001";   // unique per sensor node
const char* LOCATION   = "Lahug Bin A";  // human-readable area name
const char* BARANGAY   = "Lahug";        // must match barangay in backend

// GPS coordinates of the sensor's physical location
const float SENSOR_LAT = 10.3296;
const float SENSOR_LNG = 123.8966;
```

> **Finding your PC's IP:** Run `ipconfig` on Windows → look for **IPv4 Address** under your WiFi adapter (e.g. `192.168.1.105`). Your ESP32 and PC must be on the same WiFi network.

---

## 6. Full Source Code

Copy this entire sketch into Arduino IDE and save as `gtrash_sensor.ino`.

```cpp
// ================================================================
// G-TRASH ESP32 Sensor Node — Phase 1: Button Simulator
// Simulates MQ-135 / DHT11 / Ultrasonic readings via BOOT button.
// Each press cycles through 4 air quality modes and POSTs to backend.
// ================================================================

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ----------------------------------------------------------------
// CONFIGURATION — edit before uploading
// ----------------------------------------------------------------
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* SERVER_URL    = "http://192.168.1.X:5000/api/iot/sensor-data";

const char* SENSOR_ID     = "SENSOR-001";
const char* LOCATION      = "Lahug Bin Zone A";
const char* BARANGAY      = "Lahug";
const float SENSOR_LAT    = 10.3296;
const float SENSOR_LNG    = 123.8966;
// ----------------------------------------------------------------

#define BUTTON_PIN  0   // GPIO0 = BOOT button (active LOW, built-in pull-up)
#define LED_PIN     2   // GPIO2 = built-in LED (active HIGH)

// ----------------------------------------------------------------
// Simulation modes — matched to backend IoT thresholds
// Thresholds: ammonia moderate≥25 critical≥45 | methane moderate≥1.5 critical≥2.5
// Air quality: Good(<15/<0.8) | Moderate(≥15/≥0.8) | Unhealthy(≥25/≥1.5) | Hazardous(≥45/≥2.5)
// ----------------------------------------------------------------
struct SensorMode {
  const char* label;
  float ammonia;      // ppm  (MQ-135)
  float methane;      // % LEL (MQ-135)
  float hydrogen;     // ppm
  float co2;          // ppm
  float temperature;  // °C  (DHT11)
  float humidity;     // %   (DHT11)
  float binLevel;     // %   (Ultrasonic)
  int   ledBlinks;
};

const SensorMode MODES[] = {
  //  label        NH3    CH4   H2    CO2   Temp  Hum   Bin  Blinks
  { "Good",        5.0,  0.3,  5.0,  400,  28.5, 65.0, 20.0,  1 },
  { "Moderate",   20.0,  1.0, 15.0,  600,  29.0, 70.0, 55.0,  2 },
  { "Unhealthy",  30.0,  2.0, 25.0,  900,  30.0, 75.0, 78.0,  3 },
  { "Hazardous",  50.0,  3.0, 55.0, 1600,  31.5, 82.0, 95.0,  4 },
};
const int MODE_COUNT = 4;

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------
int  currentMode     = -1;  // starts at -1 so first press goes to 0 (Good)
bool lastButtonState = HIGH;
unsigned long lastDebounce = 0;
const unsigned long DEBOUNCE_MS = 250;

// ----------------------------------------------------------------
// LED helpers
// ----------------------------------------------------------------
void blinkLED(int times, int onMs = 180, int offMs = 180) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH);
    delay(onMs);
    digitalWrite(LED_PIN, LOW);
    delay(offMs);
  }
}

void ledSolid(bool on) {
  digitalWrite(LED_PIN, on ? HIGH : LOW);
}

// ----------------------------------------------------------------
// WiFi
// ----------------------------------------------------------------
void connectWiFi() {
  Serial.printf("[WiFi] Connecting to \"%s\"", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
    attempts++;
  }
  ledSolid(false);

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WiFi] Connected — IP: %s\n", WiFi.localIP().toString().c_str());
    blinkLED(3, 100, 100);
  } else {
    Serial.println("\n[WiFi] FAILED — check SSID/password and retry");
    // Rapid blink to signal failure
    for (int i = 0; i < 10; i++) {
      ledSolid(true);  delay(80);
      ledSolid(false); delay(80);
    }
  }
}

// ----------------------------------------------------------------
// Send reading to backend
// ----------------------------------------------------------------
void sendSensorData(const SensorMode& mode) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi lost — reconnecting...");
    connectWiFi();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[HTTP] Aborted — no WiFi");
      return;
    }
  }

  // Build payload matching backend SensorReading schema
  StaticJsonDocument<512> doc;
  doc["sensorId"]    = SENSOR_ID;
  doc["deviceType"]  = "ESP32";
  doc["location"]    = LOCATION;
  doc["barangay"]    = BARANGAY;
  doc["lat"]         = SENSOR_LAT;
  doc["lng"]         = SENSOR_LNG;
  doc["ammonia"]     = mode.ammonia;
  doc["methane"]     = mode.methane;
  doc["hydrogen"]    = mode.hydrogen;
  doc["co2"]         = mode.co2;
  doc["temperature"] = mode.temperature;
  doc["humidity"]    = mode.humidity;
  doc["binLevel"]    = mode.binLevel;
  doc["rawValue"]    = 0;

  String payload;
  serializeJson(doc, payload);

  Serial.println("\n[HTTP] Sending to backend...");
  Serial.printf("  Mode      : %s\n", mode.label);
  Serial.printf("  Ammonia   : %.1f ppm\n", mode.ammonia);
  Serial.printf("  Methane   : %.2f %% LEL\n", mode.methane);
  Serial.printf("  CO2       : %.0f ppm\n", mode.co2);
  Serial.printf("  Bin Level : %.0f %%\n", mode.binLevel);
  Serial.printf("  Temp/Hum  : %.1f°C / %.0f%%\n", mode.temperature, mode.humidity);
  Serial.printf("  Payload   : %s\n", payload.c_str());

  HTTPClient http;
  http.begin(SERVER_URL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int code = http.POST(payload);
  String response = http.getString();

  if (code == 201) {
    // Parse response to show what backend decided
    StaticJsonDocument<1024> resp;
    DeserializationError err = deserializeJson(resp, response);
    if (!err) {
      const char* aq        = resp["airQuality"] | "?";
      int alertCount        = resp["alerts"].size();
      bool hasAutoReport    = !resp["autoReport"].isNull();

      Serial.printf("[HTTP] 201 OK — airQuality=%s alerts=%d autoReport=%s\n",
        aq, alertCount, hasAutoReport ? "YES" : "no");

      if (alertCount > 0) {
        Serial.println("[HTTP] Alerts generated:");
        for (int i = 0; i < alertCount; i++) {
          Serial.printf("  [%d] severity=%s — %s\n",
            i + 1,
            resp["alerts"][i]["severity"].as<const char*>(),
            resp["alerts"][i]["message"].as<const char*>()
          );
        }
      }
      if (hasAutoReport) {
        Serial.printf("[HTTP] Auto-report created: %s\n",
          resp["autoReport"]["title"].as<const char*>());
      }
    }
    blinkLED(mode.ledBlinks, 150, 150);
  } else {
    Serial.printf("[HTTP] Error %d: %s\n", code, response.c_str());
    for (int i = 0; i < 6; i++) {
      ledSolid(true);  delay(60);
      ledSolid(false); delay(60);
    }
  }

  http.end();
}

// ----------------------------------------------------------------
// Setup
// ----------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_PIN,    OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  ledSolid(false);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════════╗");
  Serial.println("║   G-TRASH ESP32 — Button Sensor Simulator    ║");
  Serial.println("╚══════════════════════════════════════════════╝");
  Serial.printf("Sensor ID : %s\n", SENSOR_ID);
  Serial.printf("Location  : %s (%s)\n", LOCATION, BARANGAY);
  Serial.printf("GPS       : %.4f, %.4f\n", SENSOR_LAT, SENSOR_LNG);
  Serial.printf("Server    : %s\n", SERVER_URL);
  Serial.println("Press BOOT button to cycle modes and send reading.");
  Serial.println();

  connectWiFi();

  Serial.println("Modes available:");
  for (int i = 0; i < MODE_COUNT; i++) {
    Serial.printf("  [%d] %-12s NH3=%.0fppm CH4=%.1f%% Bin=%.0f%%\n",
      i, MODES[i].label, MODES[i].ammonia, MODES[i].methane, MODES[i].binLevel);
  }
  Serial.println("\nReady — press BOOT to begin.");
}

// ----------------------------------------------------------------
// Loop
// ----------------------------------------------------------------
void loop() {
  bool buttonState = digitalRead(BUTTON_PIN);

  // Detect falling edge (button pressed, active LOW)
  if (buttonState == LOW && lastButtonState == HIGH) {
    if (millis() - lastDebounce > DEBOUNCE_MS) {
      lastDebounce = millis();

      currentMode = (currentMode + 1) % MODE_COUNT;
      const SensorMode& mode = MODES[currentMode];

      Serial.printf("\n>>> BUTTON PRESSED — Mode [%d]: %s <<<\n",
        currentMode, mode.label);

      sendSensorData(mode);
    }
  }

  lastButtonState = buttonState;
  delay(10);
}
```

---

## 7. Mode Reference Table

| Press # (cycles) | Mode | Ammonia | Methane | Bin Level | Air Quality | Backend Behavior |
|---|---|---|---|---|---|---|
| 1st | **Good** | 5 ppm | 0.3% LEL | 20% | Good | Saves reading. No alert. Heatmap → `clean`. |
| 2nd | **Moderate** | 20 ppm | 1.0% LEL | 55% | Moderate | Saves reading. No alert. Heatmap → `moderate`. |
| 3rd | **Unhealthy** | 30 ppm | 2.0% LEL | 78% | Unhealthy | Saves reading. Moderate alerts (NH3 + CH4 + BinLevel). **Auto-creates Report** (Overflowing Bin, High priority). Heatmap → `critical`. |
| 4th | **Hazardous** | 50 ppm | 3.0% LEL | 95% | Hazardous | Saves reading. Critical alerts (all gases). **Auto-creates Report** (Hazardous Waste, Critical priority). Heatmap → `critical` intensity 1.0. |
| 5th | (cycles back to Good) | ... | ... | ... | ... | ... |

---

## 8. What the Backend Does Per Mode

### Mode 0 — Good
```
SensorReading saved
airQuality = "Good"
No IoTAlert generated
GarbageArea upserted: status=clean, intensity=0.2
BarangayScore +3 pts (area_clean bonus)
Socket.io emits: iot:reading, garbage-area:updated
```

### Mode 1 — Moderate
```
SensorReading saved
airQuality = "Moderate"
No IoTAlert generated (values below moderate thresholds)
GarbageArea upserted: status=moderate, intensity=0.5
BarangayScore +1 pt (area_moderate bonus)
Socket.io emits: iot:reading, garbage-area:updated
```

### Mode 2 — Unhealthy
```
SensorReading saved
airQuality = "Unhealthy"
IoTAlerts generated (severity=moderate):
  - "WARNING: Ammonia level at 30 ppm..."
  - "WARNING: Methane level at 2.0% LEL..."
  - "WARNING: Bin Level at 78%..."
Report auto-created: category=Overflowing Bin, priority=High
GarbageArea upserted: status=critical, intensity=0.8
Socket.io emits: iot:reading, iot:alert (x3), report:new, garbage-area:updated
```

### Mode 3 — Hazardous
```
SensorReading saved
airQuality = "Hazardous"
IoTAlerts generated (severity=critical):
  - "CRITICAL: Ammonia level at 50 ppm..."
  - "CRITICAL: Methane level at 3.0% LEL..."
  - "CRITICAL: CO2 level at 1600 ppm..."
  - "CRITICAL: Bin Level at 95%..."
Report auto-created: category=Hazardous Waste, priority=Critical
GarbageArea upserted: status=critical, intensity=1.0
Socket.io emits: iot:reading, iot:alert (x4), report:new, garbage-area:updated
```

---

## 9. LED Feedback Guide

| LED Pattern | Meaning |
|---|---|
| Toggling while booting | Connecting to WiFi |
| 3 quick blinks | WiFi connected |
| 10 rapid blinks | WiFi connection failed |
| **1 blink** after send | Mode 0 (Good) — reading sent OK |
| **2 blinks** after send | Mode 1 (Moderate) — reading sent OK |
| **3 blinks** after send | Mode 2 (Unhealthy) — reading sent OK |
| **4 blinks** after send | Mode 3 (Hazardous) — reading sent OK |
| 6 rapid blinks | HTTP error (check Serial Monitor) |

---

## 10. Serial Monitor Output

Set baud rate to `115200`. Expected output on first press (Mode 0 → Good):

```
╔══════════════════════════════════════════════╗
║   G-TRASH ESP32 — Button Sensor Simulator    ║
╚══════════════════════════════════════════════╝
Sensor ID : SENSOR-001
Location  : Lahug Bin Zone A (Lahug)
GPS       : 10.3296, 123.8966
Server    : http://192.168.1.105:5000/api/iot/sensor-data
Press BOOT button to cycle modes and send reading.

[WiFi] Connecting to "YourWiFi"...
[WiFi] Connected — IP: 192.168.1.201
Modes available:
  [0] Good         NH3=5ppm  CH4=0.3% Bin=20%
  [1] Moderate     NH3=20ppm CH4=1.0% Bin=55%
  [2] Unhealthy    NH3=30ppm CH4=2.0% Bin=78%
  [3] Hazardous    NH3=50ppm CH4=3.0% Bin=95%

Ready — press BOOT to begin.

>>> BUTTON PRESSED — Mode [0]: Good <<<

[HTTP] Sending to backend...
  Mode      : Good
  Ammonia   : 5.0 ppm
  Methane   : 0.30 % LEL
  CO2       : 400 ppm
  Bin Level : 20 %
  Temp/Hum  : 28.5°C / 65%
  Payload   : {"sensorId":"SENSOR-001","deviceType":"ESP32",...}
[HTTP] 201 OK — airQuality=Good alerts=0 autoReport=no
```

Expected output on 4th press (Mode 3 → Hazardous):

```
>>> BUTTON PRESSED — Mode [3]: Hazardous <<<

[HTTP] Sending to backend...
  Mode      : Hazardous
  Ammonia   : 50.0 ppm
  ...
[HTTP] 201 OK — airQuality=Hazardous alerts=4 autoReport=YES
[HTTP] Alerts generated:
  [1] severity=critical — CRITICAL: Ammonia level at 50 ppm — exceeds safe limit of 45 ppm
  [2] severity=critical — CRITICAL: Methane level at 3 % LEL — exceeds safe limit of 2.5 % LEL
  [3] severity=critical — CRITICAL: CO₂ level at 1600 ppm — exceeds safe limit of 1500 ppm
  [4] severity=critical — CRITICAL: Bin Level at 95 % — exceeds safe limit of 90 %
[HTTP] Auto-report created: IoT Alert: Hazardous Air Quality at Lahug Bin Zone A
```

---

## 11. Testing Checklist

Before testing, make sure the G-TRASH backend is running:
```bash
cd backend
npm run dev
```

Then verify with:

- [ ] Backend running on port 5000 (`GET http://localhost:5000/ping` returns `{ "ok": true }`)
- [ ] ESP32 connects to WiFi (check Serial Monitor for IP address)
- [ ] Press 1 (Good) → `GET /api/iot/readings/latest` shows SENSOR-001 with airQuality=Good
- [ ] Press 2 (Moderate) → Heatmap area status updated to `moderate`
- [ ] Press 3 (Unhealthy) → `GET /api/iot/alerts` shows 3 new moderate alerts; `GET /api/reports` shows new auto-report
- [ ] Press 4 (Hazardous) → `GET /api/iot/alerts` shows 4 critical alerts; Officials dashboard shows heatmap go red
- [ ] Socket.io events arrive in Resident app / Officials dashboard in real time
- [ ] LED blink count matches mode number (1/2/3/4 blinks)

---

## 12. Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| WiFi not connecting | Wrong SSID/password or 5GHz network | ESP32 only supports 2.4GHz; double-check credentials |
| HTTP error 400 | Missing or malformed payload | Check Serial Monitor payload; ensure `sensorId` is set |
| HTTP error -1 or timeout | Wrong server IP or backend not running | Run `ipconfig`, verify IP; ensure `npm run dev` is running |
| No LED blink feedback | LED polarity (some boards active LOW) | Change `ledSolid(true)` → `ledSolid(false)` and vice versa |
| Button not responding | GPIO0 already held LOW at boot | Wait for boot to complete before pressing; hold 1 second |
| `Connection refused` | Firewall blocking port 5000 | Allow inbound 5000 on Windows Firewall or disable temporarily |
| Garbage area not updating | No lat/lng set | Ensure `SENSOR_LAT` and `SENSOR_LNG` are non-zero |

---

## 13. Backend API Quick Reference

### Endpoint Used
```
POST http://<server-ip>:5000/api/iot/sensor-data
Content-Type: application/json
```

### Request Body (what ESP32 sends)
```json
{
  "sensorId":    "SENSOR-001",
  "deviceType":  "ESP32",
  "location":    "Lahug Bin Zone A",
  "barangay":    "Lahug",
  "lat":         10.3296,
  "lng":         123.8966,
  "ammonia":     5.0,
  "methane":     0.3,
  "hydrogen":    5.0,
  "co2":         400,
  "temperature": 28.5,
  "humidity":    65.0,
  "binLevel":    20.0,
  "rawValue":    0
}
```

### Response Body (what backend returns)
```json
{
  "reading": { ...SensorReading document },
  "airQuality": "Good",
  "alerts": [],
  "autoReport": null,
  "thresholds": {
    "ammonia":  { "moderate": 25, "critical": 45 },
    "methane":  { "moderate": 1.5, "critical": 2.5 },
    "hydrogen": { "moderate": 30, "critical": 50 },
    "co2":      { "moderate": 800, "critical": 1500 },
    "binLevel": { "moderate": 70, "critical": 90 }
  }
}
```

### Other Useful Endpoints (for testing)
```
GET  /api/iot/readings/latest       — Latest reading per sensor
GET  /api/iot/alerts                — All unacknowledged alerts
GET  /api/iot/summary               — Sensor count, active alerts
GET  /api/garbage-areas             — Heatmap nodes (check status)
PATCH /api/iot/alerts/:id/acknowledge — Dismiss an alert
```

---

## 14. Multiple Sensor Nodes

To deploy a second sensor node, change only these values in the sketch:

```cpp
const char* SENSOR_ID = "SENSOR-002";   // unique ID per node
const char* LOCATION  = "Mabolo Market Bin";
const char* BARANGAY  = "Mabolo";
const float SENSOR_LAT = 10.3215;
const float SENSOR_LNG = 123.9112;
```

The backend automatically tracks each `sensorId` separately. `GET /api/iot/readings/latest` will return one row per unique sensor.

---

## 15. Migration Path — Adding Real Sensors (Phase 2)

When you have the MQ-135 gas sensor and DHT11 temperature/humidity sensor:

### Hardware to Add
| Sensor | Pin | Library |
|---|---|---|
| MQ-135 (AOUT) | GPIO34 (analog input) | None — use `analogRead()` |
| DHT11 (DATA) | GPIO4 | DHT sensor library by Adafruit |
| HC-SR04 Ultrasonic (TRIG/ECHO) | GPIO5/GPIO18 | None — use `pulseIn()` |

### Code Changes (replace button logic with real readings)

```cpp
// --- Add libraries ---
#include <DHT.h>

#define MQ135_PIN   34
#define DHT_PIN      4
#define DHT_TYPE    DHT11
#define TRIG_PIN     5
#define ECHO_PIN    18

DHT dht(DHT_PIN, DHT_TYPE);

// --- Replace sendSensorData() call in loop() ---
// Remove: sendSensorData(MODES[currentMode]);
// Add:

float readBinLevel() {
  digitalWrite(TRIG_PIN, LOW);  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distanceCm = duration * 0.034 / 2.0;
  float binHeightCm = 60.0; // adjust to your bin height
  float level = (1.0 - (distanceCm / binHeightCm)) * 100.0;
  return constrain(level, 0.0, 100.0);
}

float rawToAmmoniaPPM(int raw) {
  // MQ-135 calibration — adjust RS_R0_RATIO per your sensor
  float RS_R0_RATIO = 3.6;
  float voltage = (raw / 4095.0) * 3.3;
  float RS = ((3.3 * 10.0) / voltage) - 10.0; // 10kΩ load resistor
  float ratio = RS / RS_R0_RATIO;
  // NH3 curve: ppm = a * ratio^b (from MQ-135 datasheet approximation)
  return 102.2 * pow(ratio, -2.473);
}

void loop() {
  // Read sensors every 30 seconds (not button-driven)
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 30000) {
    lastSend = millis();

    int raw       = analogRead(MQ135_PIN);
    float ammonia = rawToAmmoniaPPM(raw);
    float temp    = dht.readTemperature();
    float hum     = dht.readHumidity();
    float binLvl  = readBinLevel();

    SensorMode live = {
      "Live", ammonia, 0.0, 0.0, 0.0, temp, hum, binLvl, 1
    };
    sendSensorData(live);
  }
}
```

> MQ-135 calibration requires a 24-hour warm-up period and known-clean air baseline. The ammonia formula above is an approximation — fine-tune `RS_R0_RATIO` using a calibrated reference.

---

## 16. File Structure Reference

```
Get-Trash/
├── backend/
│   └── app.js              ← POST /api/iot/sensor-data lives here (line 1941)
├── ESP32_IMPLEMENTATION.md ← this file
└── (future) esp32/
    └── gtrash_sensor.ino   ← copy the sketch here
```

---

*Last updated: Phase 1 — Button Simulator (no gas sensor required)*  
*Next phase: MQ-135 + DHT11 + HC-SR04 integration (see Section 15)*
