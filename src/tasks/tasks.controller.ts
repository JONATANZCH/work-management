import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CreateTaskUseCase } from './application/use-cases/create-task.use-case';
import { GetTasksUseCase } from './application/use-cases/get-tasks.use-case';
import { GetTaskDetailUseCase } from './application/use-cases/get-task-detail.use-case';
import { AssignUsersUseCase } from './application/use-cases/assign-users.use-case';
import { CompleteTaskUseCase } from './application/use-cases/complete-task.use-case';
import { GetTaskNotificationsUseCase } from './application/use-cases/get-task-notifications.use-case';
import { CreateTaskDto } from './application/dto/create-task.dto';
import { GetTasksQueryDto } from './application/dto/get-tasks-query.dto';
import { AssignUsersDto } from './application/dto/assign-users.dto';
import { CompleteTaskDto } from './application/dto/complete-task.dto';
import { Idempotent } from '../common/decorators/idempotent.decorator';

@Controller('tasks')
export class TasksController {
  constructor(
    private readonly createTaskUseCase: CreateTaskUseCase,
    private readonly getTasksUseCase: GetTasksUseCase,
    private readonly getTaskDetailUseCase: GetTaskDetailUseCase,
    private readonly assignUsersUseCase: AssignUsersUseCase,
    private readonly completeTaskUseCase: CompleteTaskUseCase,
    private readonly getTaskNotificationsUseCase: GetTaskNotificationsUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Idempotent()
  async create(@Body() dto: CreateTaskDto) {
    return this.createTaskUseCase.execute(dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: GetTasksQueryDto) {
    return this.getTasksUseCase.execute(query.status);
  }

  @Get(':idTask')
  @HttpCode(HttpStatus.OK)
  async findById(@Param('idTask', ParseIntPipe) idTask: number) {
    return this.getTaskDetailUseCase.execute(idTask);
  }

  @Post(':idTask/assign')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  async assignUsers(
    @Param('idTask', ParseIntPipe) idTask: number,
    @Body() dto: AssignUsersDto,
  ) {
    return this.assignUsersUseCase.execute(idTask, dto);
  }

  @Post(':idTask/complete')
  @HttpCode(HttpStatus.OK)
  @Idempotent()
  async completeTask(
    @Param('idTask', ParseIntPipe) idTask: number,
    @Body() dto: CompleteTaskDto,
  ) {
    return this.completeTaskUseCase.execute(idTask, dto);
  }

  @Get(':idTask/notifications')
  @HttpCode(HttpStatus.OK)
  async findTaskNotifications(@Param('idTask', ParseIntPipe) idTask: number) {
    return this.getTaskNotificationsUseCase.execute(idTask);
  }
}
