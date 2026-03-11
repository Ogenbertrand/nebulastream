import { createApp } from "./index";

const DEFAULT_PORT = 4000;
const DEFAULT_HOST = "127.0.0.1";
const port = Number(process.env["PORT"] ?? DEFAULT_PORT);
const host = process.env["HOST"] ?? DEFAULT_HOST;

const { server } = createApp();

server.listen(port, host, () => {
  process.stdout.write(`Nebula API listening on http://${host}:${port}\n`);
});

const shutdown = (): void => {
  server.close(() => {
    process.stdout.write("Nebula API stopped\n");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
