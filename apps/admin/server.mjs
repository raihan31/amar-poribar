// Placeholder server so the `admin` image target and Compose service work before T-ADMUI-01.
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 3100);
createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end("Amar Poribar admin console placeholder\n");
}).listen(port, "0.0.0.0", () => console.log(`admin placeholder on ${port}`));
