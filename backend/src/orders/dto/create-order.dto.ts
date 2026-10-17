import { IsString, IsEnum, IsOptional, IsArray, ValidateNested, IsNumber, Min, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderType } from '../../common/enums';

export class SelectedOrderItemAddonDto {
  @IsUUID()
  addonId: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

export class CreateOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SelectedOrderItemAddonDto)
  @IsOptional()
  selectedAddOns?: SelectedOrderItemAddonDto[];
}

export class CreateOrderDto {
  @IsEnum(OrderType)
  orderType: OrderType;

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
