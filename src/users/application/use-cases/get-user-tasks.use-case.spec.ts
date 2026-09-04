import { NotFoundException } from '@nestjs/common';
import { GetUserTasksUseCase } from './get-user-tasks.use-case';
import type { IUserRepository } from '../../domain/user.repository.interface';

describe('GetUserTasksUseCase', () => {
  let useCase: GetUserTasksUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByIdWithTasks: jest.fn(),
    };
    useCase = new GetUserTasksUseCase(userRepository);
  });

  it('debe lanzar NotFoundException con code USER_NOT_FOUND si el usuario no existe', async () => {
    userRepository.findByIdWithTasks.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);

    try {
      await useCase.execute(999);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'USER_NOT_FOUND',
        message: 'User with id 999 not found',
      });
    }

    expect(userRepository.findByIdWithTasks).toHaveBeenCalledWith(999);
  });

  it('debe retornar lista de tareas con su estado de completitud (mix completadas y pendientes)', async () => {
    const mockUserWithTasks = {
      id: 1,
      name: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      tasks: [
        {
          taskId: 10,
          userId: 1,
          isCompleted: false,
          task: {
            id: 10,
            title: 'Fix issue #12',
            status: 'open',
          },
        },
        {
          taskId: 11,
          userId: 1,
          isCompleted: true,
          task: {
            id: 11,
            title: 'Write docs',
            status: 'archived',
          },
        },
      ],
    };

    userRepository.findByIdWithTasks.mockResolvedValue(mockUserWithTasks);

    const result = await useCase.execute(1);

    expect(userRepository.findByIdWithTasks).toHaveBeenCalledWith(1);
    expect(result).toEqual([
      {
        taskId: 10,
        title: 'Fix issue #12',
        status: 'open',
        isCompleted: false,
      },
      {
        taskId: 11,
        title: 'Write docs',
        status: 'archived',
        isCompleted: true,
      },
    ]);
  });
});
