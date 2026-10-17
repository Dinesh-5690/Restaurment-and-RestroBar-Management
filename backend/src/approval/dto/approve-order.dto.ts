import { IsOptional, IsString } from 'class-validator';

export class ApproveOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectOrderDto {
  @IsString()
  reason: string;
}
