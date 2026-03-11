export class InvalidEmailError extends Error {
  constructor(message = "Invalid email address") {
    super(message);
    this.name = "InvalidEmailError";
  }
}

export class UserAlreadyExistsError extends Error {
  constructor(message = "User already exists") {
    super(message);
    this.name = "UserAlreadyExistsError";
  }
}
