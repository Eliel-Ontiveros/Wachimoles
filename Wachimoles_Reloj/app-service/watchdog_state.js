import {
  readFileSync,
  statSync,
  writeFileSync
} from "@zos/fs";

const STATE_PATH = "health-monitor-watchdog.txt";
const DIAGNOSTIC_PATH = "health-monitor-watchdog-diagnostic.txt";

export function readWatchdogAlarmState() {
  const file = statSync({ path: STATE_PATH });
  if (!file) {
    return { alarmId: null, target: null };
  }
  if (file.size === 0) {
    return { alarmId: null, target: null };
  }
  const contents = readFileSync({
    path: STATE_PATH,
    options: { encoding: "utf8" }
  });
  if (typeof contents !== "string" || !/^\d+(\|[^|]+)?$/.test(contents)) {
    throw new Error("The watchdog alarm state file has invalid contents.");
  }

  const [idText, target] = contents.split("|");
  const alarmId = Number(idText);
  if (!Number.isSafeInteger(alarmId) || alarmId > 0xffffffff) {
    throw new Error("The watchdog alarm ID in storage is invalid.");
  }
  return { alarmId, target: target || null };
}

export function readWatchdogAlarmId() {
  return readWatchdogAlarmState().alarmId;
}

export function writeWatchdogAlarmId(alarmId, target = null) {
  if (
    !Number.isSafeInteger(alarmId) ||
    alarmId < 0 ||
    alarmId > 0xffffffff ||
    (target !== null && (typeof target !== "string" || target.length === 0))
  ) {
    throw new Error("The watchdog alarm ID is invalid.");
  }

  const serializedState = target ? `${alarmId}|${target}` : String(alarmId);
  writeFileSync({
    path: STATE_PATH,
    data: serializedState,
    options: { encoding: "utf8" }
  });
  const savedState = readWatchdogAlarmState();
  if (savedState.alarmId !== alarmId || savedState.target !== target) {
    throw new Error("The watchdog alarm state could not be verified.");
  }
}

export function readWatchdogDiagnostic() {
  const file = statSync({ path: DIAGNOSTIC_PATH });
  if (!file || file.size === 0) {
    return null;
  }

  const diagnostic = readFileSync({
    path: DIAGNOSTIC_PATH,
    options: { encoding: "utf8" }
  });
  if (typeof diagnostic !== "string") {
    throw new Error("The watchdog diagnostic could not be read as text.");
  }
  return diagnostic;
}

export function writeWatchdogDiagnostic(status, detail = "") {
  if (typeof status !== "string" || status.length === 0) {
    throw new Error("The watchdog diagnostic status is invalid.");
  }

  const diagnostic = `${Date.now()}|${status}|${detail}`;
  writeFileSync({
    path: DIAGNOSTIC_PATH,
    data: diagnostic,
    options: { encoding: "utf8" }
  });
  if (readWatchdogDiagnostic() !== diagnostic) {
    throw new Error("The watchdog diagnostic could not be verified.");
  }
}
