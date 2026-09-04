import { Module } from '@nestjs/common';
import { PrismaUserRepository } from './infrastructure/prisma-user.repository';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUsersUseCase } from './application/use-cases/get-users.use-case';
import { GetUserTasksUseCase } from './application/use-cases/get-user-tasks.use-case';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    CreateUserUseCase,
    GetUsersUseCase,
    GetUserTasksUseCase,
    {
      provide: 'USER_REPOSITORY',
      useClass: PrismaUserRepository,
    },
  ],
  exports: ['USER_REPOSITORY', CreateUserUseCase, GetUsersUseCase, GetUserTasksUseCase],
})
export class UsersModule {}
