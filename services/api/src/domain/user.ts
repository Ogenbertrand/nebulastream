import { Brand, EntityId } from "@nebula/core";

export type UserId = Brand<EntityId, "UserId">;

export type EmailAddress = Brand<string, "EmailAddress">;

export const toUserId = (id: EntityId): UserId => id as UserId;

export const toEmailAddress = (value: string): EmailAddress => value as EmailAddress;

export type User = {
  id: UserId;
  email: EmailAddress;
  createdAt: Date;
};

export type NewUser = {
  email: string;
};
