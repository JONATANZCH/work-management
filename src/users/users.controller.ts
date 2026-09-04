import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CreateUserUseCase } from './application/use-cases/create-user.use-case';
import { GetUsersUseCase } from './application/use-cases/get-users.use-case';
import { GetUserTasksUseCase } from './application/use-cases/get-user-tasks.use-case';
import { CreateUserDto } from './application/dto/create-user.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('users')
export class UsersController {
  constructor(
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly getUsersUseCase: GetUsersUseCase,
    private readonly getUserTasksUseCase: GetUserTasksUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  async create(@Body() dto: CreateUserDto) {
    const user = await this.createUserUseCase.execute(dto);
    return {
      id: user.id,
      name: user.name,
      lastName: user.lastName,
      email: user.email,
    };
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return this.getUsersUseCase.execute();
  }

  @Get(':idUser/tasks')
  @HttpCode(HttpStatus.OK)
  async findUserTasks(@Param('idUser', ParseIntPipe) idUser: number) {
    return this.getUserTasksUseCase.execute(idUser);
  }
}

