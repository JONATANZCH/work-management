import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskData, ITaskRepository } from '../domain/task.repository.interface';
import { Task, TaskStatusType } from '../domain/task.entity';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateTaskData): Promise<Task> {
    const created = await this.prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
      },
    });
    return new Task({
      id: created.id,
      title: created.title,
      description: created.description,
      status: created.status as TaskStatusType,
      createdAt: created.createdAt,
    });
  }

  async findAll(status?: string): Promise<any[]> {
    const whereClause: any = {};
    if (status && (status === 'open' || status === 'archived')) {
      whereClause.status = status as TaskStatus;
    }

    return this.prisma.task.findMany({
      where: whereClause,
      include: {
        assignments: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async findById(id: number): Promise<Task | null> {
    const task = await this.prisma.task.findUnique({
      where: { id },
    });
    if (!task) return null;
    return new Task({
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status as TaskStatusType,
      createdAt: task.createdAt,
    });
  }

  async findByIdWithAssignments(id: number): Promise<any | null> {
    return this.prisma.task.findUnique({
      where: { id },
      include: {
        assignments: {
          include: {
            user: true,
          },
        },
      },
    });
  }

  async updateStatus(id: number, status: TaskStatusType): Promise<Task> {
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: status as TaskStatus,
      },
    });
    return new Task({
      id: updated.id,
      title: updated.title,
      description: updated.description,
      status: updated.status as TaskStatusType,
      createdAt: updated.createdAt,
    });
  }
}
