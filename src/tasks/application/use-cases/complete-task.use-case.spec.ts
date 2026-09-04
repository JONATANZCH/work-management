import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompleteTaskUseCase } from './complete-task.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';

describe('CompleteTaskUseCase', () => {
  let useCase: CompleteTaskUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;
  let mockTx: any;
  let prismaService: any;

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };

    mockTx = {
      $queryRaw: jest.fn(),
      user: {
        findUnique: jest.fn(),
      },
      taskAssignment: {
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      task: {
        update: jest.fn(),
      },
      notificationLog: {
        create: jest.fn(),
      },
    };

    prismaService = {
      $transaction: jest.fn((cb: (tx: any) => Promise<any>) => cb(mockTx)),
    };

    useCase = new CompleteTaskUseCase(
      taskRepository,
      prismaService as unknown as PrismaService,
    );
  });

  it('debe lanzar NotFoundException con "TASK_NOT_FOUND" si la tarea no existe', async () => {
    mockTx.$queryRaw.mockResolvedValue([]);

    await expect(useCase.execute(1, { userId: 10 })).rejects.toThrow(
      NotFoundException,
    );

    try {
      await useCase.execute(1, { userId: 10 });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'TASK_NOT_FOUND',
        message: 'Task with id 1 not found',
      });
    }

    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
  });

  it('debe lanzar ConflictException con "TASK_ALREADY_ARCHIVED" si la tarea ya está archivada', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'archived' }]);

    await expect(useCase.execute(1, { userId: 10 })).rejects.toThrow(
      ConflictException,
    );

    try {
      await useCase.execute(1, { userId: 10 });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'TASK_ALREADY_ARCHIVED',
        message: 'Task with id 1 is already archived',
      });
    }

    expect(mockTx.user.findUnique).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException con "USER_NOT_FOUND" si el usuario no existe', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'open' }]);
    mockTx.user.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(1, { userId: 99 })).rejects.toThrow(
      NotFoundException,
    );

    try {
      await useCase.execute(1, { userId: 99 });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'USER_NOT_FOUND',
        message: 'User with id 99 not found',
      });
    }

    expect(mockTx.taskAssignment.findUnique).not.toHaveBeenCalled();
  });

  it('debe lanzar NotFoundException con "USER_NOT_ASSIGNED" si el usuario no está asignado', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'open' }]);
    mockTx.user.findUnique.mockResolvedValue({ id: 10, name: 'User 10' });
    mockTx.taskAssignment.findUnique.mockResolvedValue(null);

    await expect(useCase.execute(1, { userId: 10 })).rejects.toThrow(
      NotFoundException,
    );

    try {
      await useCase.execute(1, { userId: 10 });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'USER_NOT_ASSIGNED',
        message: 'User with id 10 is not assigned to task 1',
      });
    }

    expect(mockTx.taskAssignment.update).not.toHaveBeenCalled();
  });

  it('debe lanzar ConflictException con "ALREADY_COMPLETED" si la asignación ya estaba completada', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'open' }]);
    mockTx.user.findUnique.mockResolvedValue({ id: 10, name: 'User 10' });
    mockTx.taskAssignment.findUnique.mockResolvedValue({
      taskId: 1,
      userId: 10,
      isCompleted: true,
    });

    await expect(useCase.execute(1, { userId: 10 })).rejects.toThrow(
      ConflictException,
    );

    try {
      await useCase.execute(1, { userId: 10 });
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'ALREADY_COMPLETED',
        message: 'Task assignment for user 10 is already completed',
      });
    }

    expect(mockTx.taskAssignment.update).not.toHaveBeenCalled();
  });

  it('debe completar sin archivar si aún quedan usuarios pendientes (taskStatus: "open")', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'open' }]);
    mockTx.user.findUnique.mockResolvedValue({ id: 10, name: 'User 10' });
    mockTx.taskAssignment.findUnique.mockResolvedValue({
      taskId: 1,
      userId: 10,
      isCompleted: false,
    });
    mockTx.taskAssignment.update.mockResolvedValue({
      taskId: 1,
      userId: 10,
      isCompleted: true,
    });
    // Queda 1 usuario pendiente
    mockTx.taskAssignment.count.mockResolvedValue(1);

    const result = await useCase.execute(1, { userId: 10 });

    expect(mockTx.taskAssignment.update).toHaveBeenCalledWith({
      where: {
        taskId_userId: { taskId: 1, userId: 10 },
      },
      data: { isCompleted: true },
    });
    expect(mockTx.task.update).not.toHaveBeenCalled();
    expect(mockTx.notificationLog.create).not.toHaveBeenCalled();
    expect(result).toEqual({
      taskId: 1,
      userId: 10,
      isCompleted: true,
      taskStatus: 'open',
    });
  });

  it('debe completar CON archivado y evento Outbox si es el último usuario (count === 0)', async () => {
    mockTx.$queryRaw.mockResolvedValue([{ id: 1, status: 'open' }]);
    mockTx.user.findUnique.mockResolvedValue({ id: 20, name: 'User 20' });
    mockTx.taskAssignment.findUnique.mockResolvedValue({
      taskId: 1,
      userId: 20,
      isCompleted: false,
    });
    mockTx.taskAssignment.update.mockResolvedValue({
      taskId: 1,
      userId: 20,
      isCompleted: true,
    });
    // No queda ningún usuario pendiente (0 pendientes)
    mockTx.taskAssignment.count.mockResolvedValue(0);

    const result = await useCase.execute(1, { userId: 20 });

    expect(mockTx.taskAssignment.update).toHaveBeenCalledWith({
      where: {
        taskId_userId: { taskId: 1, userId: 20 },
      },
      data: { isCompleted: true },
    });
    expect(mockTx.task.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { status: 'archived' },
    });
    expect(mockTx.notificationLog.create).toHaveBeenCalledWith({
      data: {
        taskId: 1,
        attemptNumber: 1,
        status: 'PENDING',
      },
    });
    expect(result).toEqual({
      taskId: 1,
      userId: 20,
      isCompleted: true,
      taskStatus: 'archived',
    });
  });
});
