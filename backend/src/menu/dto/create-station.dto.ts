import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class CreateStationDto {
  @IsString()
  name: string;

  @IsNumber()
  @IsOptional()
  sequence?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateStationDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber()
  @IsOptional()
  sequence?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
