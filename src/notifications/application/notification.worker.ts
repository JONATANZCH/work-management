import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import axios from 'axios';
import type { INotificationLogRepository } from '../domain/notification-log.repository.interface';
import type { IDeadLetterQueueRepository } from '../domain/dead-letter-queue.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(
    @Inject('NOTIFICATION_LOG_REPOSITORY')
    private readonly notificationLogRepository: INotificationLogRepository,
    @Inject('DLQ_REPOSITORY')
    private readonly dlqRepository: IDeadLetterQueueRepository,
    private readonly prisma: PrismaService,
  ) {}

  @Cron('*/10 * * * * *')
  async handleCron() {
    const pendingLogs = await this.notificationLogRepository.findPending();

    for (const log of pendingLogs) {
      await this.processNotification(log);
    }
  }

  async processNotification(log: { id: number; taskId: number; attemptNumber: number }) {
    const task = await this.prisma.task.findUnique({
      where: { id: log.taskId },
    });

    if (!task) {
      this.logger.warn(`Task ${log.taskId} not found for notification ${log.id}`);
      return;
    }

    const payload = {
      taskId: task.id,
      title: task.title,
      archivedAt: task.createdAt.toISOString(),
    };

    const notifyUrl = process.env.NOTIFY_URL;

    try {
      if (!notifyUrl) {
        throw new Error('NOTIFY_URL environment variable is not defined');
      }

      await axios.post(notifyUrl, payload, { timeout: 5000 });
      await this.notificationLogRepository.updateStatus(log.id, 'SUCCESS');
    } catch (error) {
      await this.notificationLogRepository.updateStatus(log.id, 'FAILED');

      if (log.attemptNumber < 3) {
        const nextAttempt = log.attemptNumber + 1;
        const delayMs = Math.pow(2, log.attemptNumber) * 1000;

        setTimeout(async () => {
          try {
            await this.notificationLogRepository.create({
              taskId: log.taskId,
              attemptNumber: nextAttempt,
              status: 'PENDING',
            });
          } catch (err) {
            this.logger.error(
              `Error creating next attempt for task ${log.taskId}: ${(err as Error).message}`,
            );
          }
        }, delayMs);
      } else if (log.attemptNumber === 3) {
        await this.dlqRepository.create({
          taskId: log.taskId,
          payload: JSON.stringify(payload),
          reason: 'MAX_RETRIES_EXCEEDED',
        });
        await this.notificationLogRepository.updateStatus(log.id, 'DEAD_LETTERED');
      }
    }
  }
}
