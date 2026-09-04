import { ConflictException } from '@nestjs/common';
import { CreateUserUseCase } from './create-user.use-case';
import { IUserRepository } from '../../domain/user.repository.interface';
import { User } from '../../domain/user.entity';

describe('CreateUserUseCase', () => {
  let useCase: CreateUserUseCase;
  let userRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    userRepository = {
      create: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
    };
    useCase = new CreateUserUseCase(userRepository);
  });

  it('debe crear un usuario exitosamente cuando el email no existe', async () => {
    const dto = {
      name: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    };

    userRepository.findByEmail.mockResolvedValue(null);
    userRepository.create.mockResolvedValue(
      new User({
        id: 1,
        ...dto,
        createdAt: new Date(),
      }),
    );

    const result = await useCase.execute(dto);

    expect(userRepository.findByEmail).toHaveBeenCalledWith('john.doe@example.com');
    expect(userRepository.create).toHaveBeenCalledWith(dto);
    expect(result).toMatchObject({
      id: 1,
      name: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    });
  });

  it('debe lanzar ConflictException con code EMAIL_ALREADY_EXISTS si el email ya existe', async () => {
    const dto = {
      name: 'Jane',
      lastName: 'Doe',
      email: 'jane.doe@example.com',
    };

    userRepository.findByEmail.mockResolvedValue(
      new User({
        id: 2,
        ...dto,
        createdAt: new Date(),
      }),
    );

    await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);

    try {
      await useCase.execute(dto);
    } catch (err: any) {
      expect(err.getResponse()).toEqual({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists',
      });
    }

    expect(userRepository.create).not.toHaveBeenCalled();
  });
});
