export class DeadLetterQueue {
  id!: number;
  taskId!: number;
  payload!: string;
  reason!: string;
  failedAt!: Date;

  constructor(partial?: Partial<DeadLetterQueue>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
