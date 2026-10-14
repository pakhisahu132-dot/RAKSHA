// RAKSHA device firmware (ESP32-C3, Arduino core). UNTESTED ON HARDWARE — see README checklist.
// Libraries: TinyGPSPlus, U8g2. Output: newline-delimited JSON over USB serial, consumed by tools/serial-bridge.js.
// Input (from bridge): lines "STATE:<GPS_SEARCH|LOCATION|QUEUED|SENT|FAILED|NO_CONN|READY>" drive the OLED.
#include <Wire.h>
#include <TinyGPSPlus.h>
#include <U8g2lib.h>
#include "config.h"

#if GPS_RX_PIN < 0 || I2C_SDA_PIN < 0
#error "Set pin numbers in config.h after verifying your wiring."
#endif

TinyGPSPlus gps;
U8G2_SSD1306_128X64_NONAME_F_HW_I2C oled(U8G2_R0, U8X8_PIN_NONE);
String oledState = "READY", inbuf = "";
unsigned long lastSend = 0, lastTouch = 0, sosShownAt = 0, bootCount = 0, sosSeq = 0;
float bx = 0, by = 0, bz = 1, bdev = -1; // sample with the largest deviation from 1 g in the current window

bool readAccel(float &x, float &y, float &z) {
#if ACCEL_TYPE == ACCEL_MPU6050
  Wire.beginTransmission(0x68); Wire.write(0x3B); if (Wire.endTransmission(false)) return false;
  if (Wire.requestFrom(0x68, 6) != 6) return false;
  int16_t r[3]; for (int i = 0; i < 3; i++) { r[i] = Wire.read() << 8; r[i] |= Wire.read(); }
  x = r[0] / 4096.0f; y = r[1] / 4096.0f; z = r[2] / 4096.0f; return true; // +-8 g
#elif ACCEL_TYPE == ACCEL_ADXL345
  Wire.beginTransmission(0x53); Wire.write(0x32); if (Wire.endTransmission(false)) return false;
  if (Wire.requestFrom(0x53, 6) != 6) return false;
  int16_t r[3]; for (int i = 0; i < 3; i++) { r[i] = Wire.read(); r[i] |= Wire.read() << 8; }
  x = r[0] / 256.0f; y = r[1] / 256.0f; z = r[2] / 256.0f; return true; // full-res
#else
  return false;
#endif
}
void initAccel() {
#if ACCEL_TYPE == ACCEL_MPU6050
  Wire.beginTransmission(0x68); Wire.write(0x6B); Wire.write(0); Wire.endTransmission();
  Wire.beginTransmission(0x68); Wire.write(0x1C); Wire.write(0x10); Wire.endTransmission(); // +-8 g
#elif ACCEL_TYPE == ACCEL_ADXL345
  Wire.beginTransmission(0x53); Wire.write(0x2D); Wire.write(0x08); Wire.endTransmission();
  Wire.beginTransmission(0x53); Wire.write(0x31); Wire.write(0x0B); Wire.endTransmission(); // full-res +-16 g
#endif
}

void draw() {
#if OLED_ENABLED
  oled.clearBuffer(); oled.setFont(u8g2_font_6x12_tf);
  oled.drawStr(0, 12, "RAKSHA");
  const char* msg = oledState == "GPS_SEARCH" ? "GPS searching..." : oledState == "LOCATION" ? "Location acquired" :
    oledState == "SOS" ? "SOS INITIATED" : oledState == "QUEUED" ? "Alert queued" : oledState == "SENT" ? "Alert sent" :
    oledState == "FAILED" ? "Alert FAILED" : oledState == "NO_CONN" ? "Connection unavailable" : "Ready";
  oled.drawStr(0, 36, msg); oled.sendBuffer();
#endif
}

void setup() {
  Serial.begin(115200);
  Serial1.begin(GPS_BAUD, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  initAccel();
#if OLED_ENABLED
  oled.begin();
#endif
#if TOUCH_PIN >= 0
  pinMode(TOUCH_PIN, INPUT);
#endif
  draw();
}

void handleLine(const String& l) { if (l.startsWith("STATE:")) { oledState = l.substring(6); oledState.trim(); sosShownAt = 0; draw(); } }

void loop() {
  while (Serial1.available()) gps.encode(Serial1.read());
  while (Serial.available()) { char c = Serial.read(); if (c == '\n') { handleLine(inbuf); inbuf = ""; } else if (inbuf.length() < 40) inbuf += c; }

  float x, y, z;                                    // non-blocking: no delay() anywhere
  if (readAccel(x, y, z)) { float dev = fabs(sqrt(x * x + y * y + z * z) - 1.0f); if (dev > bdev) { bdev = dev; bx = x; by = y; bz = z; } }

#if TOUCH_PIN >= 0
  if (digitalRead(TOUCH_PIN) == HIGH && millis() - lastTouch > TOUCH_LOCKOUT_MS) { // one touch => one event
    lastTouch = millis(); sosShownAt = millis(); oledState = "SOS"; draw();
    Serial.printf("{\"type\":\"event\",\"event\":\"sos_touch\",\"id\":\"%s-%lu-%lu\"}\n", DEVICE_ID, (unsigned long)millis(), (unsigned long)++sosSeq);
  }
#endif

  if (millis() - lastSend >= 100) {
    lastSend = millis();
    bool fix = gps.location.isValid() && gps.location.age() < 3000;
    Serial.printf("{\"type\":\"telemetry\",\"deviceId\":\"%s\",\"gps\":{\"fix\":%s", DEVICE_ID, fix ? "true" : "false");
    if (fix) {
      Serial.printf(",\"lat\":%.6f,\"lng\":%.6f", gps.location.lat(), gps.location.lng());
      if (gps.hdop.isValid()) Serial.printf(",\"satellites\":%u", (unsigned)gps.satellites.value()); // no accuracy in metres is claimed
    }
    Serial.print("}");
    if (bdev >= 0) Serial.printf(",\"accel\":{\"x\":%.3f,\"y\":%.3f,\"z\":%.3f}", bx, by, bz);
    Serial.println("}");
    bdev = -1;
  }
  if (oledState == "SOS" && sosShownAt && millis() - sosShownAt > 8000) { oledState = "READY"; draw(); }
}
