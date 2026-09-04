import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { IUserRepository } from '../../domain/user.repository.interface';

export interface UserTaskItem {
  taskId: number;
  title: string;
  status: string;
  isCompleted: boolean;
}

@Injectable()
export class GetUserTasksUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(userId: number): Promise<UserTaskItem[]> {
    const user = await this.userRepository.findByIdWithTasks(userId);
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User with id ${userId} not found`,
      });
    }

    return (user.tasks || []).map((assignment: any) => ({
      taskId: assignment.task.id,
      title: assignment.task.title,
      status: assignment.task.status,
      isCompleted: assignment.isCompleted,
    }));
  }
}
