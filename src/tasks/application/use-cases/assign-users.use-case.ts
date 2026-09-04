import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';
import type { IUserRepository } from '../../../users/domain/user.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { AssignUsersDto } from '../dto/assign-users.dto';

export interface AssignUsersResult {
  taskId: number;
  assignedUserIds: number[];
}

@Injectable()
export class AssignUsersUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
    @Inject('USER_REPOSITORY')
    private readonly userRepository: IUserRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(taskId: number, dto: AssignUsersDto): Promise<AssignUsersResult> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: `Task with id ${taskId} not found`,
      });
    }

    for (const userId of dto.userIds) {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: `User with id ${userId} not found`,
        });
      }
    }

    const assignmentsData = dto.userIds.map((userId) => ({
      taskId,
      userId,
    }));

    await this.prisma.taskAssignment.createMany({
      data: assignmentsData,
      skipDuplicates: true,
    });

    return {
      taskId,
      assignedUserIds: dto.userIds,
    };
  }
}
