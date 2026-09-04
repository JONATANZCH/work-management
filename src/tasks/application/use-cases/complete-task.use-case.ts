import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { CompleteTaskDto } from '../dto/complete-task.dto';

export interface CompleteTaskResult {
  taskId: number;
  userId: number;
  isCompleted: boolean;
  taskStatus: 'open' | 'archived';
}

@Injectable()
export class CompleteTaskUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(
    taskId: number,
    dto: CompleteTaskDto,
  ): Promise<CompleteTaskResult> {
    return this.prisma.$transaction(async (tx) => {
      // a. Ejecutar SELECT FOR UPDATE sobre la tarea para concurrencia estricta
      const tasks: Array<{ id: number; status: string }> = await tx.$queryRaw`
        SELECT id, status FROM Task WHERE id = ${taskId} FOR UPDATE
      `;

      // b. Si la tarea no existe → NotFoundException "TASK_NOT_FOUND"
      if (!tasks || tasks.length === 0) {
        throw new NotFoundException({
          code: 'TASK_NOT_FOUND',
          message: `Task with id ${taskId} not found`,
        });
      }

      const task = tasks[0];

      // c. Si la tarea ya está "archived" → ConflictException "TASK_ALREADY_ARCHIVED"
      if (task.status === 'archived') {
        throw new ConflictException({
          code: 'TASK_ALREADY_ARCHIVED',
          message: `Task with id ${taskId} is already archived`,
        });
      }

      // d. Verificar que el usuario existe en User → NotFoundException "USER_NOT_FOUND"
      const user = await tx.user.findUnique({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: `User with id ${dto.userId} not found`,
        });
      }

      // e. Verificar que existe TaskAssignment para (taskId, userId) → NotFoundException "USER_NOT_ASSIGNED"
      const assignment = await tx.taskAssignment.findUnique({
        where: {
          taskId_userId: {
            taskId,
            userId: dto.userId,
          },
        },
      });

      if (!assignment) {
        throw new NotFoundException({
          code: 'USER_NOT_ASSIGNED',
          message: `User with id ${dto.userId} is not assigned to task ${taskId}`,
        });
      }

      // f. Si TaskAssignment.isCompleted ya es true → ConflictException "ALREADY_COMPLETED"
      if (assignment.isCompleted) {
        throw new ConflictException({
          code: 'ALREADY_COMPLETED',
          message: `Task assignment for user ${dto.userId} is already completed`,
        });
      }

      // g. Actualizar TaskAssignment: isCompleted = true
      await tx.taskAssignment.update({
        where: {
          taskId_userId: {
            taskId,
            userId: dto.userId,
          },
        },
        data: {
          isCompleted: true,
        },
      });

      // h. Contar TaskAssignments de la tarea con isCompleted = false
      const pendingCount = await tx.taskAssignment.count({
        where: {
          taskId,
          isCompleted: false,
        },
      });

      let finalTaskStatus: 'open' | 'archived' = 'open';

      // i. Si count === 0 (todos completaron)
      if (pendingCount === 0) {
        finalTaskStatus = 'archived';

        // Actualizar Task.status = 'archived'
        await tx.task.update({
          where: { id: taskId },
          data: { status: 'archived' },
        });

        // Insertar NotificationLog con attemptNumber=1, status='PENDING' (evento Outbox)
        await tx.notificationLog.create({
          data: {
            taskId,
            attemptNumber: 1,
            status: 'PENDING',
          },
        });
      }

      // j. Retornar resultado
      return {
        taskId,
        userId: dto.userId,
        isCompleted: true,
        taskStatus: finalTaskStatus,
      };
    });
  }
}
