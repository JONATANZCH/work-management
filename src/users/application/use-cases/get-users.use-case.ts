import { Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../domain/user.repository.interface';

export interface PendingTaskItem {
  id: number;
  title: string;
  status: string;
}

export interface UserWithPendingTasks {
  id: number;
  name: string;
  lastName: string;
  email: string;
  pendingTasks: PendingTaskItem[];
}

@Injectable()
export class GetUsersUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(): Promise<UserWithPendingTasks[]> {
    const users = await this.userRepository.findAll();

    return users.map((user) => {
      const pendingTasks: PendingTaskItem[] = (user.tasks || [])
        .filter(
          (assignment: any) =>
            assignment.isCompleted === false &&
            assignment.task &&
            assignment.task.status === 'open',
        )
        .map((assignment: any) => ({
          id: assignment.task.id,
          title: assignment.task.title,
          status: assignment.task.status,
        }));

      return {
        id: user.id,
        name: user.name,
        lastName: user.lastName,
        email: user.email,
        pendingTasks,
      };
    });
  }
}
