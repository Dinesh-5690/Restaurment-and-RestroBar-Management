import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, Min } from 'class-validator';
import { ExpenseCategory, ExpensePaymentMode } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;

  @IsEnum(ExpensePaymentMode)
  @IsOptional()
  paymentMode?: ExpensePaymentMode;

  @IsString()
  expenseDate: string;   // 'YYYY-MM-DD'

  @IsString()
  @IsOptional()
  reference?: string;

  @IsString()
  @IsOptional()
  addedBy?: string;
}

export class UpdateExpenseDto extends CreateExpenseDto {}
