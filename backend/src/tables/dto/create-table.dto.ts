import { IsNumber, IsString, IsOptional, Min, IsNotEmpty, Matches } from 'class-validator';

export class CreateTableDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Table number must be alphanumeric (letters, numbers, dashes, and underscores allowed)' })
  tableNumber: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  location?: string;
}

export class UpdateTableDto {
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9_-]+$/, { message: 'Table number must be alphanumeric (letters, numbers, dashes, and underscores allowed)' })
  tableNumber?: string;

  @IsNumber()
  @IsOptional()
  capacity?: number;

  @IsString()
  @IsOptional()
  location?: string;
}
