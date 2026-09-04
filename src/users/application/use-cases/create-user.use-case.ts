import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { IUserRepository } from '../../domain/user.repository.interface';
import { CreateUserDto } from '../dto/create-user.dto';
import { User } from '../../domain/user.entity';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject('USER_REPOSITORY')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'A user with this email already exists',
      });
    }

    return this.userRepository.create({
      name: dto.name,
      lastName: dto.lastName,
      email: dto.email,
    });
  }
}
