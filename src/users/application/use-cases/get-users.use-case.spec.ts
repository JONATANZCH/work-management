import { GetUsersUseCase } from './get-users.use-case';
import type { IUserRepository } from '../../domain/user.repository.interface';

describe('GetUsersUseCase', () => {
  let useCase: GetUsersUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    useCase = new GetUsersUseCase(userRepository);
  });

  it('caso 1: debe retornar una lista vacía cuando no existen usuarios', async () => {
    userRepository.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(userRepository.findAll).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  it('caso 2: debe retornar usuario con pendingTasks vacío si no tiene tareas asignadas o todas están completadas', async () => {
    const mockUsers = [
      {
        id: 1,
        name: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        tasks: [],
      },
      {
        id: 2,
        name: 'Bob',
        lastName: 'Jones',
        email: 'bob@example.com',
        tasks: [
          {
            taskId: 10,
            userId: 2,
            isCompleted: true,
            task: { id: 10, title: 'Finished Task', status: 'open' },
          },
          {
            taskId: 11,
            userId: 2,
            isCompleted: false,
            task: { id: 11, title: 'Archived Task', status: 'archived' },
          },
        ],
      },
    ];

    userRepository.findAll.mockResolvedValue(mockUsers);

    const result = await useCase.execute();

    expect(result).toEqual([
      {
        id: 1,
        name: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        pendingTasks: [],
      },
      {
        id: 2,
        name: 'Bob',
        lastName: 'Jones',
        email: 'bob@example.com',
        pendingTasks: [],
      },
    ]);
  });

  it('caso 3: debe filtrar y retornar únicamente las tareas con isCompleted=false y task.status="open"', async () => {
    const mockUsers = [
      {
        id: 3,
        name: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@example.com',
        tasks: [
          {
            taskId: 101,
            userId: 3,
            isCompleted: false,
            task: { id: 101, title: 'Pending Open Task 1', status: 'open' },
          },
          {
            taskId: 102,
            userId: 3,
            isCompleted: true,
            task: { id: 102, title: 'Completed Task', status: 'open' },
          },
          {
            taskId: 103,
            userId: 3,
            isCompleted: false,
            task: { id: 103, title: 'Archived Task', status: 'archived' },
          },
          {
            taskId: 104,
            userId: 3,
            isCompleted: false,
            task: { id: 104, title: 'Pending Open Task 2', status: 'open' },
          },
        ],
      },
    ];

    userRepository.findAll.mockResolvedValue(mockUsers);

    const result = await useCase.execute();

    expect(result).toEqual([
      {
        id: 3,
        name: 'Charlie',
        lastName: 'Brown',
        email: 'charlie@example.com',
        pendingTasks: [
          {
            id: 101,
            title: 'Pending Open Task 1',
            status: 'open',
          },
          {
            id: 104,
            title: 'Pending Open Task 2',
            status: 'open',
          },
        ],
      },
    ]);
  });
});
