import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateApprovalItemDto {
  @IsString()
  menuItemName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsIn(['FOOD', 'BEVERAGE'])
  category: 'FOOD' | 'BEVERAGE';

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsIn(['30ML', '60ML', '90ML', 'BOTTLE'])
  @IsOptional()
  servingSize?: string;

  @IsNumber()
  @IsOptional()
  bottleSizeMl?: number;

  @IsBoolean()
  @IsOptional()
  bottleOrderFlag?: boolean;
}
