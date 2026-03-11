import { Clock, EntityId, Result, err, ok, systemClock, toEntityId } from "@nebula/core";
import { randomUUID } from "node:crypto";
import { InvalidEmailError, UserAlreadyExistsError } from "../domain/errors";
import { NewUser, User, toEmailAddress, toUserId } from "../domain/user";
import { UserRepository } from "../domain/user_repository";

type RegisterUserDependencies = {
  repository: UserRepository;
  clock?: Clock;
  idFactory?: () => EntityId;
};

export type RegisterUserResult = Result<User, InvalidEmailError | UserAlreadyExistsError>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (value: string): boolean => EMAIL_REGEX.test(value);

export class RegisterUser {
  private readonly repository: UserRepository;
  private readonly clock: Clock;
  private readonly idFactory: () => EntityId;

  constructor({ repository, clock = systemClock, idFactory }: RegisterUserDependencies) {
    this.repository = repository;
    this.clock = clock;
    this.idFactory = idFactory ?? (() => toEntityId(randomUUID()));
  }

  async execute(input: NewUser): Promise<RegisterUserResult> {
    const email = input.email.trim().toLowerCase();

    if (!isValidEmail(email)) {
      return err(new InvalidEmailError());
    }

    const existing = await this.repository.findByEmail(toEmailAddress(email));

    if (existing) {
      return err(new UserAlreadyExistsError());
    }

    const user: User = {
      id: toUserId(this.idFactory()),
      email: toEmailAddress(email),
      createdAt: this.clock.now()
    };

    await this.repository.save(user);

    return ok(user);
  }
}
