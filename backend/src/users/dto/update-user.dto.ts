import { IsString, IsEnum, MinLength, IsOptional, IsNumber, Min, IsArray, ArrayUnique, IsIn, IsBoolean } from 'class-validator';
import { UserRole } from '../../common/enums';
import { SalaryType } from './create-user.dto';

export type AccessRight = 'DASHBOARD' | 'POS' | 'KITCHEN' | 'APPROVAL' | 'TABLES' | 'KIOSK' | 'ADMIN';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['MONTHLY', 'DAILY', 'WEEKLY', 'BIWEEKLY'] as const)
  salaryType?: SalaryType;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salaryAmount?: number;

  @IsOptional()
  @IsString()
  basicDetails?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(['DASHBOARD', 'POS', 'KITCHEN', 'APPROVAL', 'TABLES', 'KIOSK', 'ADMIN'], { each: true })
  accessRights?: AccessRight[];

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
