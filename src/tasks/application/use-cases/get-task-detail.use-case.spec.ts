import { NotFoundException } from '@nestjs/common';
import { GetTaskDetailUseCase } from './get-task-detail.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';

describe('GetTaskDetailUseCase', () => {
  let useCase: GetTaskDetailUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new GetTaskDetailUseCase(taskRepository);
  });

  it('debe lanzar NotFoundException con code "TASK_NOT_FOUND" si la tarea no existe', async () => {
    taskRepository.findByIdWithAssignments.mockResolvedValue(null);

    await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);

    try {
      await useCase.execute(999);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'TASK_NOT_FOUND',
        message: 'Task with id 999 not found',
      });
    }

    expect(taskRepository.findByIdWithAssignments).toHaveBeenCalledWith(999);
  });

  it('debe retornar el detalle de la tarea con usuarios asignados (mix completados y no completados)', async () => {
    const mockTaskDetail = {
      id: 1,
      title: 'Tarea con asignaciones',
      description: 'Detalle de la tarea',
      status: 'open',
      createdAt: new Date(),
      assignments: [
        {
          taskId: 1,
          userId: 10,
          isCompleted: false,
          user: {
            id: 10,
            name: 'Juan',
            lastName: 'Perez',
            email: 'juan@example.com',
          },
        },
        {
          taskId: 1,
          userId: 20,
          isCompleted: true,
          user: {
            id: 20,
            name: 'Ana',
            lastName: 'Lopez',
            email: 'ana@example.com',
          },
        },
      ],
    };

    taskRepository.findByIdWithAssignments.mockResolvedValue(mockTaskDetail);

    const result = await useCase.execute(1);

    expect(taskRepository.findByIdWithAssignments).toHaveBeenCalledWith(1);
    expect(result).toEqual({
      id: 1,
      title: 'Tarea con asignaciones',
      description: 'Detalle de la tarea',
      status: 'open',
      assignedUsers: [
        {
          id: 10,
          name: 'Juan',
          lastName: 'Perez',
          email: 'juan@example.com',
          isCompleted: false,
        },
        {
          id: 20,
          name: 'Ana',
          lastName: 'Lopez',
          email: 'ana@example.com',
          isCompleted: true,
        },
      ],
    });
  });
});
