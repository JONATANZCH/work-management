import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateNotificationLogData,
  INotificationLogRepository,
} from '../domain/notification-log.repository.interface';
import { NotificationLog } from '../domain/notification-log.entity';

@Injectable()
export class PrismaNotificationLogRepository implements INotificationLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationLogData): Promise<NotificationLog> {
    const created = await this.prisma.notificationLog.create({
      data: {
        taskId: data.taskId,
        attemptNumber: data.attemptNumber,
        status: data.status,
      },
    });

    return new NotificationLog(created);
  }

  async findByTaskId(taskId: number): Promise<NotificationLog[]> {
    const logs = await this.prisma.notificationLog.findMany({
      where: { taskId },
      orderBy: { attemptNumber: 'asc' },
    });

    return logs.map((log) => new NotificationLog(log));
  }

  async findPending(): Promise<NotificationLog[]> {
    const logs = await this.prisma.notificationLog.findMany({
      where: { status: 'PENDING' },
      orderBy: { timestamp: 'asc' },
    });

    return logs.map((log) => new NotificationLog(log));
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.prisma.notificationLog.update({
      where: { id },
      data: { status },
    });
  }
}
