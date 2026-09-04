import { Inject, Injectable } from '@nestjs/common';
import type { ITaskRepository } from '../../domain/task.repository.interface';
import { CreateTaskDto } from '../dto/create-task.dto';

@Injectable()
export class CreateTaskUseCase {
  constructor(
    @Inject('TASK_REPOSITORY')
    private readonly taskRepository: ITaskRepository,
  ) {}

  async execute(dto: CreateTaskDto) {
    const task = await this.taskRepository.create({
      title: dto.title,
      description: dto.description ?? null,
    });

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status ?? 'open',
    };
  }
}
