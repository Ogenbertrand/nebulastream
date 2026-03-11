export type Brand<T, B extends string> = T & { readonly __brand: B };

export type EntityId = Brand<string, "EntityId">;

export const toEntityId = (value: string): EntityId => value as EntityId;

export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date()
};
