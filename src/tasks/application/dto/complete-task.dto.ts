import { IsInt, IsNotEmpty } from 'class-validator';

export class CompleteTaskDto {
  @IsNotEmpty()
  @IsInt()
  userId!: number;
}
