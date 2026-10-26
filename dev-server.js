// Local preview without Vercel: serves index.html and the API with in-memory storage.
const http = require("http"), fs = require("fs"), path = require("path");
const api = require("./api/signups");
http.createServer((req, res) => {
  if (req.url.startsWith("/api/signups")) return api(req, res);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(fs.readFileSync(path.join(__dirname, "index.html")));
}).listen(3000, () => console.log("http://localhost:3000"));
