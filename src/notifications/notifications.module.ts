import { Module } from '@nestjs/common';
import { PrismaNotificationLogRepository } from './infrastructure/prisma-notification-log.repository';
import { PrismaDeadLetterQueueRepository } from './infrastructure/prisma-dlq.repository';
import { NotificationWorker } from './application/notification.worker';

@Module({
  providers: [
    NotificationWorker,
    {
      provide: 'NOTIFICATION_LOG_REPOSITORY',
      useClass: PrismaNotificationLogRepository,
    },
    {
      provide: 'DLQ_REPOSITORY',
      useClass: PrismaDeadLetterQueueRepository,
    },
  ],
  exports: [
    'NOTIFICATION_LOG_REPOSITORY',
    'DLQ_REPOSITORY',
    NotificationWorker,
  ],
})
export class NotificationsModule {}
