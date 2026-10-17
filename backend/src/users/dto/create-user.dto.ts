import { IsString, IsEnum, MinLength, IsOptional, IsNumber, Min, IsArray, ArrayUnique, IsIn } from 'class-validator';
import { UserRole } from '../../common/enums';

export type SalaryType = 'MONTHLY' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY';
export type AccessRight = 'DASHBOARD' | 'POS' | 'KITCHEN' | 'APPROVAL' | 'TABLES' | 'KIOSK' | 'ADMIN';

export class CreateUserDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  name: string;

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

  @IsEnum(UserRole)
  role: UserRole;
}
