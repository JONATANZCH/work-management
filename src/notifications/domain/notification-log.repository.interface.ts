import { NotificationLog } from './notification-log.entity';

export interface CreateNotificationLogData {
  taskId: number;
  attemptNumber: number;
  status: string;
}

export interface INotificationLogRepository {
  create(data: CreateNotificationLogData): Promise<NotificationLog>;
  findByTaskId(taskId: number): Promise<NotificationLog[]>;
  findPending(): Promise<NotificationLog[]>;
  updateStatus(id: number, status: string): Promise<void>;
}
