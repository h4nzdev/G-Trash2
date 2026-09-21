const IOT_THRESHOLDS = {
  clean: 200,    // ADC threshold for clean air
  critical: 400, // ADC threshold for critical garbage-area air quality
  hydrogen: { moderate: 30, critical: 50 }, // ppm (optional)
  co2: { moderate: 800, critical: 1500 }, // ppm (optional)
  binLevel: { moderate: 70, critical: 90 }, // %
};

function classifyAirQuality(rawValue, cleanThreshold = 200, criticalThreshold = 400) {
  const val = Number(rawValue) || 0;
  const crit = Number(criticalThreshold) || 400;
  const clean = Number(cleanThreshold) || 200;

  if (val >= crit) return "CRITICAL";
  if (val >= clean) return "MODERATE";
  return "CLEAN";
}

function generateIoTAlerts(reading) {
  const alerts = [];
  const rawVal = Number(reading.rawValue) || 0;
  const critThresh = Number(reading.criticalThreshold) || 400;
  const cleanThresh = Number(reading.cleanThreshold) || 200;

  const exceededCritical = [];
  const exceededModerate = [];

  if (rawVal >= critThresh) {
    exceededCritical.push(`Garbage-Area Air Quality (${rawVal} ADC)`);
  } else if (rawVal >= cleanThresh) {
    exceededModerate.push(`Garbage-Area Air Quality (${rawVal} ADC)`);
  }

  // Check optional hardware peripherals if present
  const optionalChecks = [
    { field: "binLevel", label: "Bin Level", unit: "%" },
    { field: "hydrogen", label: "Hydrogen", unit: "ppm" },
    { field: "co2", label: "CO₂", unit: "ppm" },
  ];

  for (const { field, label, unit } of optionalChecks) {
    const val = reading[field] || 0;
    const thresh = IOT_THRESHOLDS[field];
    if (!thresh || val <= 0) continue;
    if (val >= thresh.critical) {
      exceededCritical.push(`${label} (${val} ${unit})`);
    } else if (val >= thresh.moderate) {
      exceededModerate.push(`${label} (${val} ${unit})`);
    }
  }

  if (exceededCritical.length > 0) {
    alerts.push({
      sensorId: reading.sensorId,
      location: reading.location || "",
      barangay: reading.barangay || "",
      severity: "critical",
      message: `CRITICAL parameters exceeded: ${exceededCritical.join(", ")}`,
      gasType: "MQ-135 Air Quality",
      value: rawVal,
      threshold: critThresh,
    });
  } else if (exceededModerate.length > 0) {
    alerts.push({
      sensorId: reading.sensorId,
      location: reading.location || "",
      barangay: reading.barangay || "",
      severity: "moderate",
      message: `MODERATE warning parameters: ${exceededModerate.join(", ")}`,
      gasType: "MQ-135 Air Quality",
      value: rawVal,
      threshold: cleanThresh,
    });
  } else {
    alerts.push({
      sensorId: reading.sensorId,
      location: reading.location || "",
      barangay: reading.barangay || "",
      severity: "clean",
      message: `Clean air conditions verified (${rawVal} ADC, threshold: <${cleanThresh})`,
      gasType: "MQ-135 Air Quality",
      value: rawVal,
      threshold: cleanThresh,
    });
  }

  return alerts;
}

module.exports = {
  IOT_THRESHOLDS,
  classifyAirQuality,
  generateIoTAlerts,
};

