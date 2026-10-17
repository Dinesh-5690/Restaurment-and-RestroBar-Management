import { IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  kitchenStation?: string;

  @IsNumber()
  @IsOptional()
  sequence?: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  kitchenStation?: string;

  @IsNumber()
  @IsOptional()
  sequence?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  description?: string;
}
