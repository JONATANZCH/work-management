export class User {
  id!: number;
  name!: string;
  lastName!: string;
  email!: string;
  createdAt!: Date;

  constructor(partial?: Partial<User>) {
    if (partial) {
      Object.assign(this, partial);
    }
  }
}
