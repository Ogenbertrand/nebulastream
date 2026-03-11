import * as http from "node:http";
import { RegisterUser } from "../application/register_user";
import { InvalidEmailError, UserAlreadyExistsError } from "../domain/errors";

type CreateHttpServerDependencies = {
  registerUser: RegisterUser;
};

type JsonRecord = Record<string, unknown>;

const writeJson = (res: http.ServerResponse, status: number, payload: JsonRecord): void => {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
};

const readJsonBody = async (req: http.IncomingMessage, limit = 1_000_000): Promise<unknown> => {
  let body = "";

  for await (const chunk of req) {
    body += chunk;
    if (body.length > limit) {
      throw new Error("Payload too large");
    }
  }

  if (body.length === 0) {
    return {};
  }

  return JSON.parse(body);
};

const extractEmail = (payload: unknown): string | null => {
  if (payload && typeof payload === "object" && "email" in payload) {
    const email = (payload as { email?: unknown }).email;
    return typeof email === "string" ? email : null;
  }

  return null;
};

export const createHttpServer = ({ registerUser }: CreateHttpServerDependencies): http.Server =>
  http.createServer(async (req, res) => {
    try {
      if (req.method === "POST" && req.url === "/users") {
        const body = await readJsonBody(req);
        const email = extractEmail(body);

        if (!email) {
          writeJson(res, 400, { error: "email is required" });
          return;
        }

        const result = await registerUser.execute({ email });

        if (result.ok) {
          writeJson(res, 201, {
            id: result.value.id,
            email: result.value.email,
            createdAt: result.value.createdAt.toISOString()
          });
          return;
        }

        if (result.error instanceof InvalidEmailError) {
          writeJson(res, 400, { error: result.error.message });
          return;
        }

        if (result.error instanceof UserAlreadyExistsError) {
          writeJson(res, 409, { error: result.error.message });
          return;
        }

        writeJson(res, 500, { error: "Unexpected error" });
        return;
      }

      writeJson(res, 404, { error: "Not found" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      writeJson(res, 500, { error: message });
    }
  });
