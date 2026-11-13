const MAX_BODY_BYTES = 16 * 1024;
const MAX_HEART_RATE_BPM = 250;

function isValidSample(sample) {
  if (
    !sample ||
    typeof sample.sampleId !== "string" ||
    sample.sampleId.length === 0 ||
    sample.sampleId.length > 120 ||
    typeof sample.value !== "number" ||
    !Number.isFinite(sample.value) ||
    !Number.isSafeInteger(sample.measuredAt) ||
    sample.measuredAt <= 0 ||
    !Number.isFinite(new Date(sample.measuredAt).getTime()) ||
    (sample.sensorTime !== undefined &&
      !Number.isSafeInteger(sample.sensorTime))
  ) {
    return false;
  }

  if (sample.metric === "heart_rate") {
    return (
      sample.value > 0 &&
      sample.value <= MAX_HEART_RATE_BPM &&
      sample.unit === "bpm"
    );
  }

  if (sample.metric === "spo2") {
    return sample.value > 0 && sample.value <= 100 && sample.unit === "%";
  }

  if (sample.metric === "stress") {
    return sample.value >= 0 && sample.unit === "score";
  }

  if (sample.metric === "steps") {
    return (
      Number.isSafeInteger(sample.value) &&
      sample.value >= 0 &&
      sample.unit === "steps" &&
      /^steps-\d{4}-\d{2}-\d{2}$/.test(sample.sampleId)
    );
  }

  return false;
}

module.exports = { isValidSample, MAX_BODY_BYTES };
