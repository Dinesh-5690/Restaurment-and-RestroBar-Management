import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { Order } from '../orders/entities/order.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Expense, Order])],
  providers: [ExpensesService],
  controllers: [ExpensesController],
})
export class ExpensesModule {}
