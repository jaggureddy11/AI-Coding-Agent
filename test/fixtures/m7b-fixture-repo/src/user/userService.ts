import { UserRepository, User } from './userRepository.js';

export interface RegistrationInput {
  username: string;
  email: string;
  password?: string;
}

export class UserService {
  constructor(private repo: UserRepository) {}

  public register(input: RegistrationInput): User {
    // Initial implementation without validation
    const user: User = {
      id: `user_${Date.now()}`,
      username: input.username,
      email: input.email,
      createdAt: new Date(),
    };
    this.repo.save(user);
    return user;
  }
}
