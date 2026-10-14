// ===== RAKSHA device config — EDIT AFTER VERIFYING YOUR OWN MODULES =====
// Nothing here is assumed to match your board. Check each module's printed label/datasheet,
// logic level (ESP32-C3 GPIO is 3.3 V, NOT 5 V tolerant) and your actual wiring before flashing.
#pragma once
#define DEVICE_ID "raksha-esp32c3-1"

// GPS (NMEA over UART). The "S6MV2" label is not confirmed to be a specific chip: verify baud with a serial monitor.
#define GPS_RX_PIN  -1   // ESP32 pin wired to GPS TX   <-- SET ME
#define GPS_TX_PIN  -1   // ESP32 pin wired to GPS RX   <-- SET ME
#define GPS_BAUD    9600 // common default; verify

// I2C bus shared by OLED + accelerometer
#define I2C_SDA_PIN -1   // <-- SET ME
#define I2C_SCL_PIN -1   // <-- SET ME

// Accelerometer: ACCEL_MPU6050 (addr 0x68), ACCEL_ADXL345 (addr 0x53) or ACCEL_NONE. Identify your chip first (scan I2C).
#define ACCEL_MPU6050 1
#define ACCEL_ADXL345 2
#define ACCEL_NONE    0
#define ACCEL_TYPE ACCEL_NONE

// OLED: assumes SSD1306 128x64 I2C (addr 0x3C). Change the U8g2 constructor in the .ino if yours differs.
#define OLED_ENABLED 1

// Touch sensor: digital output module (HIGH when touched). Set to -1 to disable.
#define TOUCH_PIN -1     // <-- SET ME
#define TOUCH_LOCKOUT_MS 5000  // debounce + ignore repeats so one touch = one SOS

// SpO2 and temperature: NOT implemented (module/library unverified). They are omitted from telemetry,
// so the app shows "Unavailable". Add your verified driver in readSpo2()/readTempC().
