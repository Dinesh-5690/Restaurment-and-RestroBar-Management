import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum KioskOrderType {
  DINE_IN = 'DINE_IN',
  TAKE_AWAY = 'TAKE_AWAY',
}

export enum KioskPaymentMethod {
  COUNTER = 'COUNTER',
  ONLINE_QR = 'ONLINE_QR',
  ONLINE_CARD = 'ONLINE_CARD',
}

export class KioskOrderItemAddonDto {
  @IsUUID()
  addonId: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  quantity?: number;
}

export class KioskOrderItemDto {
  @IsUUID()
  menuItemId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KioskOrderItemAddonDto)
  @IsOptional()
  selectedAddOns?: KioskOrderItemAddonDto[];
}

export class KioskCheckoutDto {
  @IsEnum(KioskOrderType)
  orderType: KioskOrderType;

  @IsOptional()
  @IsString()
  tableId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsEnum(KioskPaymentMethod)
  paymentMethod: KioskPaymentMethod;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => KioskOrderItemDto)
  items: KioskOrderItemDto[];
}
