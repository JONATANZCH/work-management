import { Inject, Injectable } from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';

export interface AssignedUserItem {
  id: number;
  name: string;
  lastName: string;
  isCompleted: boolean;
}

export interface TaskListItem {
  id: number;
  title: string;
  description: string | null;
  status: string;
  assignedUsers: AssignedUserItem[];
}

@Injectable()
export class GetTasksUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(status?: 'open' | 'archived'): Promise<TaskListItem[]> {
    const tasks = await this.taskRepository.findAll(status);

    return tasks.map((task) => {
      const assignedUsers: AssignedUserItem[] = (task.assignments || []).map(
        (assignment: any) => ({
          id: assignment.user.id,
          name: assignment.user.name,
          lastName: assignment.user.lastName,
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
    });
  }
}
