import { Task, TaskStatusType } from './task.entity';

export interface CreateTaskData {
  title: string;
  description?: string | null;
}

export interface ITaskRepository {
  create(data: CreateTaskData): Promise<Task>;
  findAll(status?: string): Promise<any[]>;
  findById(id: number): Promise<Task | null>;
  findByIdWithAssignments(id: number): Promise<any | null>;
  updateStatus(id: number, status: TaskStatusType): Promise<Task>;
}
