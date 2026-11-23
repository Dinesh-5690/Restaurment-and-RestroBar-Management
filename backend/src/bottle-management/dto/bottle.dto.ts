import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RegisterBottleDto {
  @IsString() beverageId: string;
  @IsString() batchId: string;
  @IsInt() @Min(1) bottleSizeMl: number;
  @IsString() @IsOptional() bottleCode?: string;
  @IsBoolean() @IsOptional() authorized?: boolean;
}

export class BottleOperationDto {
  @IsString() bottleCode: string;
  @IsString() @IsOptional() remarks?: string;
}

export class BottleHistoryFilterDto {
  from?: string;
  to?: string;
  operationType?: 'IN' | 'OUT';
  beverageId?: string;
  bottleId?: string;
}
