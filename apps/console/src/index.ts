import { ok, Result } from "@nebula/core";

type StartupInfo = {
  message: string;
  startedAt: string;
};

const result: Result<StartupInfo> = ok({
  message: "NebulaStream console ready",
  startedAt: new Date().toISOString()
});

const output = result.ok
  ? `ok: ${JSON.stringify(result.value)}`
  : `err: ${String(result.error)}`;

process.stdout.write(`${output}\n`);
