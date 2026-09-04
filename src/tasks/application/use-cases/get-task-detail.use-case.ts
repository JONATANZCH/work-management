import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';

export interface TaskDetailAssignedUser {
  id: number;
  name: string;
  lastName: string;
  email: string;
  isCompleted: boolean;
}

export interface TaskDetail {
  id: number;
  title: string;
  description: string | null;
  status: string;
  assignedUsers: TaskDetailAssignedUser[];
}

@Injectable()
export class GetTaskDetailUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(id: number): Promise<TaskDetail> {
    const task = await this.taskRepository.findByIdWithAssignments(id);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: `Task with id ${id} not found`,
      });
    }

    const assignedUsers: TaskDetailAssignedUser[] = (task.assignments || []).map(
      (assignment: any) => ({
        id: assignment.user.id,
        name: assignment.user.name,
        lastName: assignment.user.lastName,
        email: assignment.user.email,
        isCompleted: assignment.isCompleted,
      }),
    );

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      assignedUsers,
    };
  }
}
