import { DeadLetterQueue } from './dead-letter-queue.entity';

export interface CreateDeadLetterQueueData {
  taskId: number;
  payload: string;
  reason: string;
}

export interface IDeadLetterQueueRepository {
  create(data: CreateDeadLetterQueueData): Promise<DeadLetterQueue>;
}
