import {
  IsString,
  IsOptional,
  IsEnum,
} from 'class-validator';
import { AttendanceStatus } from '../entities/attendance.entity';

export class CheckInDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class CheckOutDto {
  @IsString()
  @IsOptional()
  note?: string;
}

export class ManualAttendanceDto {
  @IsString()
  userId: string;

  @IsString()
  attendanceDate: string;

  @IsString()
  @IsOptional()
  checkInAt?: string;

  @IsString()
  @IsOptional()
  checkOutAt?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateAttendanceDto {
  @IsString()
  @IsOptional()
  attendanceDate?: string;

  @IsString()
  @IsOptional()
  checkInAt?: string;

  @IsString()
  @IsOptional()
  checkOutAt?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  status?: AttendanceStatus;

  @IsString()
  @IsOptional()
  note?: string;
}
