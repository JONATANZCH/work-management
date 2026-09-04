import { User } from './user.entity';

export interface CreateUserData {
  name: string;
  lastName: string;
  email: string;
}

export interface IUserRepository {
  create(data: CreateUserData): Promise<User>;
  findAll(): Promise<any[]>;
  findById(id: number): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByIdWithTasks(id: number): Promise<any | null>;
}
