export class NotificationLog {
  id!: number;
  taskId!: number;
  attemptNumber!: number;
  status!: string;
  timestamp!: Date;

  constructor(partial?: Partial<NotificationLog>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
