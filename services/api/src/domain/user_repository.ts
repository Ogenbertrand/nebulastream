import { EmailAddress, User } from "./user";

export interface UserRepository {
  findByEmail(email: EmailAddress): Promise<User | null>;
  save(user: User): Promise<void>;
}
