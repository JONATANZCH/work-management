import { GetTasksUseCase } from './get-tasks.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';

describe('GetTasksUseCase', () => {
  let useCase: GetTasksUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;

  const mockTasks = [
    {
      id: 1,
      title: 'Tarea 1',
      description: 'Desc 1',
      status: 'open',
      createdAt: new Date(),
      assignments: [
        {
          taskId: 1,
          userId: 10,
          isCompleted: false,
          user: {
            id: 10,
            name: 'Carlos',
            lastName: 'Santana',
            email: 'carlos@example.com',
          },
        },
      ],
    },
    {
      id: 2,
      title: 'Tarea 2',
      description: null,
      status: 'archived',
      createdAt: new Date(),
      assignments: [
        {
          taskId: 2,
          userId: 20,
          isCompleted: true,
          user: {
            id: 20,
            name: 'Maria',
            lastName: 'Gomez',
            email: 'maria@example.com',
          },
        },
      ],
    },
  ];

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new GetTasksUseCase(taskRepository);
  });

  it('debe retornar todas las tareas cuando no se provee filtro (sin filtro)', async () => {
    taskRepository.findAll.mockResolvedValue(mockTasks);

    const result = await useCase.execute();

    expect(taskRepository.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([
      {
        id: 1,
        title: 'Tarea 1',
        description: 'Desc 1',
        status: 'open',
        assignedUsers: [
          {
            id: 10,
            name: 'Carlos',
            lastName: 'Santana',
            isCompleted: false,
          },
        ],
      },
      {
        id: 2,
        title: 'Tarea 2',
        description: null,
        status: 'archived',
        assignedUsers: [
          {
            id: 20,
            name: 'Maria',
            lastName: 'Gomez',
            isCompleted: true,
          },
        ],
      },
    ]);
  });

  it('debe filtrar por tareas open cuando se especifica status "open"', async () => {
    const openTasks = [mockTasks[0]];
    taskRepository.findAll.mockResolvedValue(openTasks);

    const result = await useCase.execute('open');

    expect(taskRepository.findAll).toHaveBeenCalledWith('open');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      title: 'Tarea 1',
      description: 'Desc 1',
      status: 'open',
      assignedUsers: [
        {
          id: 10,
          name: 'Carlos',
          lastName: 'Santana',
          isCompleted: false,
        },
      ],
    });
  });

  it('debe filtrar por tareas archived cuando se especifica status "archived"', async () => {
    const archivedTasks = [mockTasks[1]];
    taskRepository.findAll.mockResolvedValue(archivedTasks);

    const result = await useCase.execute('archived');

    expect(taskRepository.findAll).toHaveBeenCalledWith('archived');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 2,
      title: 'Tarea 2',
      description: null,
      status: 'archived',
      assignedUsers: [
        {
          id: 20,
          name: 'Maria',
          lastName: 'Gomez',
          isCompleted: true,
        },
      ],
    });
  });

  it('debe retornar un array vacío cuando no hay tareas (lista vacía)', async () => {
    taskRepository.findAll.mockResolvedValue([]);

    const result = await useCase.execute();

    expect(taskRepository.findAll).toHaveBeenCalledWith(undefined);
    expect(result).toEqual([]);
  });
});
