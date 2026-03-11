import { EmailAddress, User } from "../domain/user";
import { UserRepository } from "../domain/user_repository";

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: EmailAddress): Promise<User | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }

    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id as string, user);
  }
}
