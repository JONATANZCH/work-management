import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';
import type { INotificationLogRepository } from '../../../notifications/domain/notification-log.repository.interface';

export interface TaskNotificationItem {
  id: number;
  taskId: number;
  attemptNumber: number;
  status: string;
  timestamp: Date;
}

@Injectable()
export class GetTaskNotificationsUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
    @Inject('NOTIFICATION_LOG_REPOSITORY')
    private readonly notificationLogRepository: INotificationLogRepository,
  ) {}

  async execute(taskId: number): Promise<TaskNotificationItem[]> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: `Task with id ${taskId} not found`,
      });
    }

    const logs = await this.notificationLogRepository.findByTaskId(taskId);

    return logs
      .sort((a, b) => a.attemptNumber - b.attemptNumber)
      .map((log) => ({
        id: log.id,
        taskId: log.taskId,
        attemptNumber: log.attemptNumber,
        status: log.status,
        timestamp: log.timestamp,
      }));
  }
}
