const http = require("node:http");
const path = require("node:path");
const { appendFile, mkdir, readFile, writeFile } = require("node:fs/promises");
const { isValidSample, MAX_BODY_BYTES } = require("./sample-validation");

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let receivedBytes = 0;
    let settled = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      receivedBytes += Buffer.byteLength(chunk);
      if (receivedBytes > MAX_BODY_BYTES) {
        settled = true;
        reject(new Error("Request body exceeds the allowed size."));
        request.resume();
        return;
      }

      body += chunk;
    });
    request.on("end", () => {
      if (!settled) {
        resolve(body);
      }
    });
    request.on("error", (error) => {
      if (!settled) {
        reject(error);
      }
    });
  });
}

function createServer(options = {}) {
  const dataFile =
    options.dataFile || path.join(__dirname, "data", "samples.jsonl");
  let records = null;
  let persistenceQueue = Promise.resolve();

  function withRecords(action) {
    const operation = persistenceQueue.then(async () => {
      if (records === null) {
        try {
          const contents = await readFile(dataFile, "utf8");
          records = contents
            .split(/\r?\n/)
            .filter(Boolean)
            .map((line) => JSON.parse(line));
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
          records = [];
        }
      }

      return action(records);
    });
    persistenceQueue = operation.catch(() => {});
    return operation;
  }

  return http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");

    if (request.method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method !== "POST" || requestUrl.pathname !== "/samples") {
      sendJson(response, 404, { ok: false, error: "Route not found." });
      return;
    }

    let body;
    try {
      body = await readJsonBody(request);
    } catch (error) {
      sendJson(response, 413, {
        ok: false,
        error: error.message || "Could not read request body."
      });
      return;
    }

    let sample;
    try {
      sample = JSON.parse(body);
    } catch {
      sendJson(response, 400, { ok: false, error: "Invalid JSON." });
      return;
    }

    if (!isValidSample(sample)) {
      sendJson(response, 400, {
        ok: false,
        error: "Expected a valid heart-rate, SpO2, stress, steps, or sleep sample."
      });
      return;
    }

    const record = {
      ...sample,
      receivedAt: Date.now()
    };

    try {
      const result = await withRecords(async (storedRecords) => {
        const existingIndex = storedRecords.findIndex(
          (storedRecord) => storedRecord.sampleId === sample.sampleId
        );
        if (existingIndex !== -1) {
          if (!["steps", "sleep"].includes(sample.metric)) {
            return { duplicate: true };
          }

          const updatedRecords = [...storedRecords];
          updatedRecords[existingIndex] = record;
          await writeFile(
            dataFile,
            `${updatedRecords.map((item) => JSON.stringify(item)).join("\n")}\n`,
            "utf8"
          );
          records = updatedRecords;
          return { updated: true };
        }

        await mkdir(path.dirname(dataFile), { recursive: true });
        await appendFile(dataFile, `${JSON.stringify(record)}\n`, "utf8");
        storedRecords.push(record);
        return { inserted: true };
      });

      if (result.duplicate) {
        sendJson(response, 200, {
          ok: true,
          duplicate: true,
          sampleId: sample.sampleId
        });
        return;
      }

      if (result.updated) {
        sendJson(response, 200, {
          ok: true,
          duplicate: false,
          updated: true,
          sampleId: record.sampleId,
          receivedAt: record.receivedAt
        });
        return;
      }
    } catch (error) {
      console.error("Could not persist sample:", error);
      sendJson(response, 500, {
        ok: false,
        error: "Could not persist sample."
      });
      return;
    }

    sendJson(response, 201, {
      ok: true,
      duplicate: false,
      sampleId: record.sampleId,
      receivedAt: record.receivedAt
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  const server = createServer();
  server.listen(port, "0.0.0.0", () => {
    console.log(`Sample API listening on port ${port}`);
    console.log("Use this server only on a trusted local network.");
  });
}

module.exports = { createServer, isValidSample };
