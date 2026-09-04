import { Module } from '@nestjs/common';
import { PrismaTaskRepository } from './infrastructure/prisma-task.repository';
import { CreateTaskUseCase } from './application/use-cases/create-task.use-case';
import { GetTasksUseCase } from './application/use-cases/get-tasks.use-case';
import { GetTaskDetailUseCase } from './application/use-cases/get-task-detail.use-case';
import { AssignUsersUseCase } from './application/use-cases/assign-users.use-case';
import { CompleteTaskUseCase } from './application/use-cases/complete-task.use-case';
import { GetTaskNotificationsUseCase } from './application/use-cases/get-task-notifications.use-case';
import { TasksController } from './tasks.controller';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [UsersModule, NotificationsModule],
  controllers: [TasksController],
  providers: [
    CreateTaskUseCase,
    GetTasksUseCase,
    GetTaskDetailUseCase,
    AssignUsersUseCase,
    CompleteTaskUseCase,
    GetTaskNotificationsUseCase,
    {
      provide: 'TASK_REPOSITORY',
      useClass: PrismaTaskRepository,
    },
  ],
  exports: [
    'TASK_REPOSITORY',
    CreateTaskUseCase,
    GetTasksUseCase,
    GetTaskDetailUseCase,
    AssignUsersUseCase,
    CompleteTaskUseCase,
    GetTaskNotificationsUseCase,
  ],
})
export class TasksModule {}
