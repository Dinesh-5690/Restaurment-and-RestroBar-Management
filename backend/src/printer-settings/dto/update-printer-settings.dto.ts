import { IsString, IsNumber, IsOptional, IsObject, IsArray } from 'class-validator';
import { ReceiptElementKey, ReceiptAlignment, ReceiptElementPosition } from '../entities/printer-settings.entity';

export class UpdatePrinterSettingsDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsNumber()
  receiptWidthMm?: number;

  @IsOptional()
  @IsNumber()
  headerHeightPx?: number;

  @IsOptional()
  @IsNumber()
  logoSizePx?: number;

  @IsOptional()
  @IsObject()
  elementAlignments?: Record<ReceiptElementKey, ReceiptAlignment>;

  @IsOptional()
  @IsObject()
  elementPositions?: Record<ReceiptElementKey, ReceiptElementPosition>;

  @IsOptional()
  @IsArray()
  elementOrder?: ReceiptElementKey[];
}
