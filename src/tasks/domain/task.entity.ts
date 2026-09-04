export type TaskStatusType = 'open' | 'archived';

export class Task {
  id!: number;
  title!: string;
  description!: string | null;
  status!: TaskStatusType;
  createdAt!: Date;

  constructor(partial?: Partial<Task>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
