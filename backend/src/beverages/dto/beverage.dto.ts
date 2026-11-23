import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
export class BeverageCategoryDto {
  @IsString() name: string;
  @IsBoolean() @IsOptional() active?: boolean;
}
export class BeverageProductDto {
  @IsString() categoryId: string;
  @IsString() brand: string;
  @IsString() @IsOptional() productName?: string;
  @IsNumber() @Min(1) bottleSize: number;
  @IsNumber() @Min(0) abv: number;
  @IsNumber() @Min(0) bottlePrice: number;
  @IsNumber() @Min(0) price30ml: number;
  @IsNumber() @Min(0) price60ml: number;
  @IsNumber() @Min(0) price90ml: number;
  @IsString() @IsOptional() imagePath?: string;
  @IsBoolean() @IsOptional() active?: boolean;
  @IsNumber() @Min(0) @IsOptional() availableMl?: number;
}
export class StockAdjustmentDto {
  @IsNumber() quantityMl: number;
  @IsString() @IsOptional() referenceId?: string;
}
