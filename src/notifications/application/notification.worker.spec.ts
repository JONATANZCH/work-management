import { NotificationWorker } from './notification.worker';
import { INotificationLogRepository } from '../domain/notification-log.repository.interface';
import { IDeadLetterQueueRepository } from '../domain/dead-letter-queue.repository.interface';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('NotificationWorker', () => {
  let worker: NotificationWorker;
  let notificationLogRepository: jest.Mocked<INotificationLogRepository>;
  let dlqRepository: jest.Mocked<IDeadLetterQueueRepository>;
  let prismaService: any;

  const mockDate = new Date('2026-09-04T10:00:00.000Z');
  const mockTask = {
    id: 1,
    title: 'Tarea Finalizada',
    createdAt: mockDate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.NOTIFY_URL = 'https://webhook.example.com/notify';

    notificationLogRepository = {
      create: jest.fn(),
      findByTaskId: jest.fn(),
      findPending: jest.fn(),
      updateStatus: jest.fn(),
    };

    dlqRepository = {
      create: jest.fn(),
    };

    prismaService = {
      task: {
        findUnique: jest.fn().mockResolvedValue(mockTask),
      },
    };

    worker = new NotificationWorker(
      notificationLogRepository,
      dlqRepository,
      prismaService as unknown as PrismaService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debe completar con éxito en primer intento cuando axios responde 2xx', async () => {
    notificationLogRepository.findPending.mockResolvedValue([
      {
        id: 10,
        taskId: 1,
        attemptNumber: 1,
        status: 'PENDING',
        timestamp: new Date(),
      },
    ]);

    mockedAxios.post.mockResolvedValue({ status: 200, data: 'OK' });

    await worker.handleCron();

    expect(prismaService.task.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://webhook.example.com/notify',
      {
        taskId: 1,
        title: 'Tarea Finalizada',
        archivedAt: mockDate.toISOString(),
      },
      { timeout: 5000 },
    );
    expect(notificationLogRepository.updateStatus).toHaveBeenCalledWith(10, 'SUCCESS');
    expect(notificationLogRepository.create).not.toHaveBeenCalled();
    expect(dlqRepository.create).not.toHaveBeenCalled();
  });

  it('debe marcar FAILED y programar reintento con backoff si axios falla y attemptNumber < 3', async () => {
    const pendingLog = {
      id: 10,
      taskId: 1,
      attemptNumber: 1,
      status: 'PENDING',
      timestamp: new Date(),
    };

    notificationLogRepository.findPending.mockResolvedValue([pendingLog]);
    mockedAxios.post.mockRejectedValue(new Error('Network error or 500'));

    await worker.handleCron();

    expect(notificationLogRepository.updateStatus).toHaveBeenCalledWith(10, 'FAILED');
    expect(notificationLogRepository.create).not.toHaveBeenCalled();

    // Avanzamos el timer según el backoff: 2^1 * 1000 = 2000 ms
    jest.advanceTimersByTime(2000);

    // Permitir resolución de microtasks/promesas
    await Promise.resolve();

    expect(notificationLogRepository.create).toHaveBeenCalledWith({
      taskId: 1,
      attemptNumber: 2,
      status: 'PENDING',
    });
    expect(dlqRepository.create).not.toHaveBeenCalled();
  });

  it('debe enviar a DeadLetterQueue y marcar DEAD_LETTERED si falla en intento 3 (attemptNumber === 3)', async () => {
    const pendingLog = {
      id: 12,
      taskId: 1,
      attemptNumber: 3,
      status: 'PENDING',
      timestamp: new Date(),
    };

    notificationLogRepository.findPending.mockResolvedValue([pendingLog]);
    mockedAxios.post.mockRejectedValue(new Error('Gateway Timeout 504'));

    await worker.handleCron();

    expect(notificationLogRepository.updateStatus).toHaveBeenCalledWith(12, 'FAILED');
    expect(dlqRepository.create).toHaveBeenCalledWith({
      taskId: 1,
      payload: JSON.stringify({
        taskId: 1,
        title: 'Tarea Finalizada',
        archivedAt: mockDate.toISOString(),
      }),
      reason: 'MAX_RETRIES_EXCEEDED',
    });
    expect(notificationLogRepository.updateStatus).toHaveBeenCalledWith(12, 'DEAD_LETTERED');
    expect(notificationLogRepository.create).not.toHaveBeenCalled();
  });
});
