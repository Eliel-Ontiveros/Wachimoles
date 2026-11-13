const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createServer } = require("./server");

let server;
let baseUrl;
let dataFile;
let tempDirectory;

before(async () => {
  tempDirectory = await mkdtemp(path.join(os.tmpdir(), "wachimoles-hr-test-"));
  dataFile = path.join(tempDirectory, "samples.jsonl");
  server = createServer({ dataFile });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await rm(tempDirectory, { recursive: true, force: true });
});

test("health endpoint reports readiness", async () => {
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("sample endpoint validates and persists a heart-rate reading", async () => {
  const sample = {
    sampleId: "hr-test-1",
    metric: "heart_rate",
    value: 72,
    unit: "bpm",
    measuredAt: 1794190000000
  };
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample)
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.duplicate, false);
  assert.equal(result.sampleId, sample.sampleId);

  const records = (await readFile(dataFile, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(records.length, 1);
  assert.equal(records[0].value, sample.value);
  assert.equal(records[0].receivedAt > 0, true);
});

test("sample endpoint validates and persists an SpO2 reading", async () => {
  const sample = {
    sampleId: "spo2-test-1",
    metric: "spo2",
    value: 97,
    unit: "%",
    measuredAt: 1794190000001
  };
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample)
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.sampleId, sample.sampleId);

  const records = (await readFile(dataFile, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(records.length, 2);
  assert.equal(records[1].metric, "spo2");
  assert.equal(records[1].value, 97);
});

test("sample endpoint validates and persists a current stress reading", async () => {
  const sample = {
    sampleId: "stress-test-1",
    metric: "stress",
    value: 42,
    unit: "score",
    measuredAt: 1794190000002,
    sensorTime: 1794190000
  };
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sample)
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.ok, true);
  assert.equal(result.sampleId, sample.sampleId);

  const records = (await readFile(dataFile, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(records.length, 3);
  assert.equal(records[2].metric, "stress");
  assert.equal(records[2].value, 42);
  assert.equal(records[2].unit, "score");
  assert.equal(records[2].sensorTime, sample.sensorTime);
});

test("repeated sample IDs are acknowledged without duplicate persistence", async () => {
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sampleId: "hr-test-1",
      metric: "heart_rate",
      value: 72,
      unit: "bpm",
      measuredAt: 1794190000000
    })
  });

  assert.equal(response.status, 200);
  assert.equal((await response.json()).duplicate, true);
  const records = (await readFile(dataFile, "utf8")).trim().split("\n");
  assert.equal(records.length, 3);
});

test("invalid sample payloads are rejected", async () => {
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ metric: "heart_rate", value: -1 })
  });

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "Expected a valid heart-rate, SpO2, or stress sample."
  });
});

test("SpO2 values above 100 are rejected", async () => {
  const response = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sampleId: "spo2-invalid",
      metric: "spo2",
      value: 101,
      unit: "%",
      measuredAt: 1794190000002
    })
  });

  assert.equal(response.status, 400);
  assert.equal((await response.json()).ok, false);
});

test("daily step samples update the existing record", async () => {
  const sampleId = "steps-2026-11-11";
  const firstResponse = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sampleId,
      metric: "steps",
      value: 1200,
      unit: "steps",
      measuredAt: 1794190000003
    })
  });
  assert.equal(firstResponse.status, 201);

  const updateResponse = await fetch(`${baseUrl}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sampleId,
      metric: "steps",
      value: 1850,
      unit: "steps",
      measuredAt: 1794190600003
    })
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).updated, true);

  const records = (await readFile(dataFile, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const stepRecords = records.filter((record) => record.metric === "steps");
  assert.equal(stepRecords.length, 1);
  assert.equal(stepRecords[0].value, 1850);
  assert.equal(stepRecords[0].measuredAt, 1794190600003);
});
