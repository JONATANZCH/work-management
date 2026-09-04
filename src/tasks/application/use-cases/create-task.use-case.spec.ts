import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { CreateTaskUseCase } from './create-task.use-case';
import { ITaskRepository } from '../../domain/task.repository.interface';
import { Task } from '../../domain/task.entity';
import { CreateTaskDto } from '../dto/create-task.dto';

describe('CreateTaskUseCase', () => {
  let useCase: CreateTaskUseCase;
  let taskRepository: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    taskRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByIdWithAssignments: jest.fn(),
      updateStatus: jest.fn(),
    };
    useCase = new CreateTaskUseCase(taskRepository);
  });

  it('debe crear una tarea exitosamente con status "open" por defecto', async () => {
    const dto: CreateTaskDto = {
      title: 'Nueva Tarea',
      description: 'Descripción de prueba',
    };

    taskRepository.create.mockResolvedValue(
      new Task({
        id: 1,
        title: dto.title,
        description: dto.description,
        status: 'open',
        createdAt: new Date(),
      }),
    );

    const result = await useCase.execute(dto);

    expect(taskRepository.create).toHaveBeenCalledWith({
      title: 'Nueva Tarea',
      description: 'Descripción de prueba',
    });
    expect(result).toEqual({
      id: 1,
      title: 'Nueva Tarea',
      description: 'Descripción de prueba',
      status: 'open',
    });
  });

  describe('ValidationPipe handling', () => {
    let target: ValidationPipe;
    const metadata: ArgumentMetadata = {
      type: 'body',
      metatype: CreateTaskDto,
      data: '',
    };

    beforeEach(() => {
      target = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });
    });

    it('debe fallar la validación si falta el título', async () => {
      const invalidDto = {
        description: 'Falta el título',
      };

      await expect(target.transform(invalidDto, metadata)).rejects.toThrow();
    });

    it('debe pasar la validación si se proporciona título sin descripción (opcional)', async () => {
      const validDto = {
        title: 'Tarea sin descripción',
      };

      const transformed = await target.transform(validDto, metadata);
      expect(transformed).toBeInstanceOf(CreateTaskDto);
      expect(transformed.title).toBe('Tarea sin descripción');
    });
  });
});
