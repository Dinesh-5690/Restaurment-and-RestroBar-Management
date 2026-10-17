import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ReservationStatus } from '../../common/enums';

export class CreateReservationDto {
  @IsString()
  customerName: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsInt()
  @Min(1)
  partySize: number;

  @IsString()
  reservationDate: string;

  @IsString()
  reservationTime: string;

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  specialRequest?: string;

  @IsString()
  @IsOptional()
  createdBy?: string;

  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;
}

export class UpdateReservationDto {
  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  partySize?: number;

  @IsString()
  @IsOptional()
  reservationDate?: string;

  @IsString()
  @IsOptional()
  reservationTime?: string;

  @IsString()
  @IsOptional()
  tableId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  specialRequest?: string;

  @IsEnum(ReservationStatus)
  @IsOptional()
  status?: ReservationStatus;
}

export class UpdateReservationStatusDto {
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}
