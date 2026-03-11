import * as http from "node:http";
import { RegisterUser } from "./application/register_user";
import { InMemoryUserRepository } from "./infrastructure/in_memory_user_repository";
import { createHttpServer } from "./interfaces/http_server";

export type ApiApp = {
  server: http.Server;
  registerUser: RegisterUser;
  repository: InMemoryUserRepository;
};

export const createApp = (): ApiApp => {
  const repository = new InMemoryUserRepository();
  const registerUser = new RegisterUser({ repository });
  const server = createHttpServer({ registerUser });

  return { server, registerUser, repository };
};
