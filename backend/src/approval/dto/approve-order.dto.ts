import { IsOptional, IsString, Matches } from 'class-validator';

export class ApproveOrderDto {
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectOrderDto {
  @IsString()
  @Matches(/\S/, { message: 'A rejection reason is required' })
  reason: string;
}

export class ItemReasonDto {
  @IsString()
  @Matches(/\S/, { message: 'A reason is required' })
  reason: string;
}
