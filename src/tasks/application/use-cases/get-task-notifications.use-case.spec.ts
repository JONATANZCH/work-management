import { NotFoundException } from '@nestjs/common';
import { GetTaskNotificationsUseCase } from './get-task-notifications.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';
import { INotificationLogRepository } from '../../../notifications/domain/notification-log.repository.interface';
import { Task } from '../../domain/task.entity';
import { NotificationLog } from '../../../notifications/domain/notification-log.entity';

describe('GetTaskNotificationsUseCase', () => {
  let useCase: GetTaskNotificationsUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;
  let notificationLogRepository: jest.Mocked<INotificationLogRepository>;

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };

    notificationLogRepository = {
      create: jest.fn(),
      findByTaskId: jest.fn(),
      findPending: jest.fn(),
      updateStatus: jest.fn(),
    };

    useCase = new GetTaskNotificationsUseCase(
      taskRepository,
      notificationLogRepository,
    );
  });

  it('debe lanzar NotFoundException con "TASK_NOT_FOUND" si la tarea no existe', async () => {
    taskRepository.findById.mockResolvedValue(null);

    await expect(useCase.execute(404)).rejects.toThrow(NotFoundException);

    try {
      await useCase.execute(404);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'TASK_NOT_FOUND',
        message: 'Task with id 404 not found',
      });
    }

    expect(taskRepository.findById).toHaveBeenCalledWith(404);
    expect(notificationLogRepository.findByTaskId).not.toHaveBeenCalled();
  });

  it('debe retornar array vacío si la tarea existe pero no tiene notificaciones', async () => {
    taskRepository.findById.mockResolvedValue(
      new Task({
        id: 1,
        title: 'Task without notifications',
        description: null,
        status: 'open',
        createdAt: new Date(),
      }),
    );

    notificationLogRepository.findByTaskId.mockResolvedValue([]);

    const result = await useCase.execute(1);

    expect(taskRepository.findById).toHaveBeenCalledWith(1);
    expect(notificationLogRepository.findByTaskId).toHaveBeenCalledWith(1);
    expect(result).toEqual([]);
  });

  it('debe retornar historial ordenado por attemptNumber ASC cuando tiene múltiples reintentos', async () => {
    taskRepository.findById.mockResolvedValue(
      new Task({
        id: 1,
        title: 'Task with retries',
        description: 'Testing retries',
        status: 'archived',
        createdAt: new Date(),
      }),
    );

    const date1 = new Date('2026-09-04T10:00:00Z');
    const date2 = new Date('2026-09-04T10:00:02Z');
    const date3 = new Date('2026-09-04T10:00:06Z');

    // Supongamos que el repo los entrega desordenados
    const logsFromRepo: NotificationLog[] = [
      new NotificationLog({
        id: 3,
        taskId: 1,
        attemptNumber: 3,
        status: 'DEAD_LETTERED',
        timestamp: date3,
      }),
      new NotificationLog({
        id: 1,
        taskId: 1,
        attemptNumber: 1,
        status: 'FAILED',
        timestamp: date1,
      }),
      new NotificationLog({
        id: 2,
        taskId: 1,
        attemptNumber: 2,
        status: 'FAILED',
        timestamp: date2,
      }),
    ];

    notificationLogRepository.findByTaskId.mockResolvedValue(logsFromRepo);

    const result = await useCase.execute(1);

    expect(taskRepository.findById).toHaveBeenCalledWith(1);
    expect(notificationLogRepository.findByTaskId).toHaveBeenCalledWith(1);
    expect(result).toEqual([
      {
        id: 1,
        taskId: 1,
        attemptNumber: 1,
        status: 'FAILED',
        timestamp: date1,
      },
      {
        id: 2,
        taskId: 1,
        attemptNumber: 2,
        status: 'FAILED',
        timestamp: date2,
      },
      {
        id: 3,
        taskId: 1,
        attemptNumber: 3,
        status: 'DEAD_LETTERED',
        timestamp: date3,
      },
    ]);
  });
});
