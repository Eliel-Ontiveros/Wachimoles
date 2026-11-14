const http = require("node:http");
const https = require("node:https");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const PROXY_PREFIX = "/__api_proxy";

function buildProxyTargets() {
  const configured = (
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_LOCAL_API_URL ||
    "http://192.168.50.75:3000"
  )
    .trim()
    .replace(/\/+$/, "");
  return Array.from(
    new Set([configured, "http://127.0.0.1:3000", "http://localhost:3000"].filter(Boolean))
  );
}

function readRequestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return Promise.resolve(null);
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : null));
    req.on("error", reject);
  });
}

function forwardToTarget(targetBase, targetPath, method, headers, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(targetPath, targetBase);
    const client = url.protocol === "https:" ? https : http;
    const proxyReq = client.request(
      url,
      {
        method,
        headers,
        timeout: 4500,
      },
      (proxyRes) => {
        const resChunks = [];
        proxyRes.on("data", (chunk) => resChunks.push(chunk));
        proxyRes.on("end", () => {
          resolve({
            statusCode: proxyRes.statusCode || 502,
            headers: proxyRes.headers,
            body: Buffer.concat(resChunks),
          });
        });
      }
    );
    proxyReq.on("timeout", () => {
      proxyReq.destroy(new Error("Proxy request timed out"));
    });
    proxyReq.on("error", reject);
    if (body) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
}

const config = getDefaultConfig(__dirname);

const previousEnhanceMiddleware = config.server?.enhanceMiddleware;
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware, metroServer) => {
    const baseMiddleware = previousEnhanceMiddleware
      ? previousEnhanceMiddleware(middleware, metroServer)
      : middleware;

    return async (req, res, next) => {
      if (!req.url || !req.url.startsWith(`${PROXY_PREFIX}/`)) {
        return baseMiddleware(req, res, next);
      }

      const targetPath = req.url.slice(PROXY_PREFIX.length) || "/";
      const forwardHeaders = {};
      if (req.headers.accept) forwardHeaders.accept = req.headers.accept;
      if (req.headers.authorization) forwardHeaders.authorization = req.headers.authorization;
      if (req.headers["content-type"]) forwardHeaders["content-type"] = req.headers["content-type"];

      try {
        const body = await readRequestBody(req);
        if (body) {
          forwardHeaders["content-length"] = String(body.length);
        }

        const targets = buildProxyTargets();
        let lastError = null;
        for (const targetBase of targets) {
          try {
            const upstream = await forwardToTarget(
              targetBase,
              targetPath,
              req.method || "GET",
              forwardHeaders,
              body
            );
            const responseHeaders = {};
            if (upstream.headers["content-type"]) {
              responseHeaders["content-type"] = upstream.headers["content-type"];
            }
            if (upstream.headers["cache-control"]) {
              responseHeaders["cache-control"] = upstream.headers["cache-control"];
            }
            res.writeHead(upstream.statusCode, responseHeaders);
            res.end(upstream.body);
            return;
          } catch (err) {
            lastError = err;
          }
        }

        res.writeHead(502, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: "No se pudo conectar con el backend desde el proxy de desarrollo.",
            detail: lastError instanceof Error ? lastError.message : String(lastError),
          })
        );
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: err instanceof Error ? err.message : "Error interno del proxy de desarrollo.",
          })
        );
      }
    };
  },
};

module.exports = withNativeWind(config, { input: "./src/global.css" });

