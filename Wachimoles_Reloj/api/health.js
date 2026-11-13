module.exports = function healthHandler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    response.status(405).json({ ok: false, error: "Method not allowed." });
    return;
  }

  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({ ok: true });
};
