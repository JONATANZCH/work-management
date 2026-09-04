import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDeadLetterQueueData,
  IDeadLetterQueueRepository,
} from '../domain/dead-letter-queue.repository.interface';
import { DeadLetterQueue } from '../domain/dead-letter-queue.entity';

@Injectable()
export class PrismaDeadLetterQueueRepository implements IDeadLetterQueueRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateDeadLetterQueueData): Promise<DeadLetterQueue> {
    const created = await this.prisma.deadLetterQueue.create({
      data: {
        taskId: data.taskId,
        payload: data.payload,
        reason: data.reason,
      },
    });

    return new DeadLetterQueue(created);
  }
}
