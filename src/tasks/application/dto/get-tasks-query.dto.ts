import { IsEnum, IsOptional } from 'class-validator';

export class GetTasksQueryDto {
  @IsOptional()
  @IsEnum(['open', 'archived'], {
    message: 'status must be either open or archived',
  })
  status?: 'open' | 'archived';
}
