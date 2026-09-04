import { NotFoundException } from '@nestjs/common';
import { AssignUsersUseCase } from './assign-users.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';
import { IUserRepository } from '../../../users/domain/user.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { Task } from '../../domain/task.entity';
import { User } from '../../../users/domain/user.entity';

describe('AssignUsersUseCase', () => {
  let useCase: AssignUsersUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let prismaService: any;

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };

    userRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByIdWithTasks: jest.fn(),
    };

    prismaService = {
      taskAssignment: {
        createMany: jest.fn(),
      },
    };

    useCase = new AssignUsersUseCase(
      taskRepository,
      userRepository,
      prismaService as unknown as PrismaService,
    );
  });

  it('debe lanzar NotFoundException con "TASK_NOT_FOUND" si la tarea no existe', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(1, { userIds: [10, 20] })).rejects.toThrow(
      NotFoundException,
    );

    try {
      await useCase.execute(1, { userIds: [10, 20] });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'TASK_NOT_FOUND',
        message: 'Task with id 1 not found',
      });
    }

    expect(taskRepository.findById).toHaveBeenCalledWith(1);
    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(prismaService.taskAssignment.createMany).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException con "USER_NOT_FOUND" indicando el id faltante si un usuario no existe', async () => {
    taskRepository.findById.mockResolvedValue(
      new Task({
        id: 1,
        title: 'Task 1',
        description: null,
        status: 'open',
        createdAt: new Date(),
      }),
    );

    userRepository.findById.mockImplementation(async (id: number) => {
      if (id === 10) {
        return new User({
          id: 10,
          name: 'Carlos',
          lastName: 'Santana',
          email: 'carlos@example.com',
          createdAt: new Date(),
        });
      }
      return null;
    });

    await expect(useCase.execute(1, { userIds: [10, 999] })).rejects.toThrow(
      NotFoundException,
    );

    try {
      await useCase.execute(1, { userIds: [10, 999] });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'USER_NOT_FOUND',
        message: 'User with id 999 not found',
      });
    }

    expect(prismaService.taskAssignment.createMany).not.toHaveBeenCalled();
  });

  it('debe realizar asignación nueva exitosamente llamando a createMany con skipDuplicates', async () => {
    taskRepository.findById.mockResolvedValue(
      new Task({
        id: 1,
        title: 'Task 1',
        description: null,
        status: 'open',
        createdAt: new Date(),
      }),
    );

    userRepository.findById.mockResolvedValue(
      new User({
        id: 10,
        name: 'User 10',
        lastName: 'Test',
        email: 'user10@example.com',
        createdAt: new Date(),
      }),
    );

    prismaService.taskAssignment.createMany.mockResolvedValue({ count: 2 });

    const result = await useCase.execute(1, { userIds: [10, 20] });

    expect(prismaService.taskAssignment.createMany).toHaveBeenCalledWith({
      data: [
        { taskId: 1, userId: 10 },
        { taskId: 1, userId: 20 },
      ],
      skipDuplicates: true,
    });

    expect(result).toEqual({
      taskId: 1,
      assignedUserIds: [10, 20],
    });
  });

  it('debe ignorar asignaciones duplicadas de forma transparente (skipDuplicates: true)', async () => {
    taskRepository.findById.mockResolvedValue(
      new Task({
        id: 1,
        title: 'Task 1',
        description: null,
        status: 'open',
        createdAt: new Date(),
      }),
    );

    userRepository.findById.mockResolvedValue(
      new User({
        id: 10,
        name: 'User 10',
        lastName: 'Test',
        email: 'user10@example.com',
        createdAt: new Date(),
      }),
    );

    // Si ambos o uno ya existía, createMany con skipDuplicates lo omite e inserta los restantes
    prismaService.taskAssignment.createMany.mockResolvedValue({ count: 0 });

    const result = await useCase.execute(1, { userIds: [10] });

    expect(prismaService.taskAssignment.createMany).toHaveBeenCalledWith({
      data: [{ taskId: 1, userId: 10 }],
      skipDuplicates: true,
    });

    expect(result).toEqual({
      taskId: 1,
      assignedUserIds: [10],
    });
  });
});
