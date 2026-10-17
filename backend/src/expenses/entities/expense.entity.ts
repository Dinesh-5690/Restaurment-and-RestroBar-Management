import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ExpenseCategory {
  INGREDIENTS   = 'INGREDIENTS',
  UTILITIES     = 'UTILITIES',
  STAFF         = 'STAFF',
  RENT          = 'RENT',
  EQUIPMENT     = 'EQUIPMENT',
  MARKETING     = 'MARKETING',
  MAINTENANCE   = 'MAINTENANCE',
  OTHER         = 'OTHER',
}

export enum ExpensePaymentMode {
  CASH   = 'CASH',
  CARD   = 'CARD',
  BANK   = 'BANK',
  UPI    = 'UPI',
  OTHER  = 'OTHER',
}

@Entity('expenses')
export class Expense {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'float' })
  amount: number;

  @Column({ type: 'varchar', default: ExpenseCategory.OTHER })
  category: ExpenseCategory;

  @Column({ type: 'varchar', default: ExpensePaymentMode.CASH })
  paymentMode: ExpensePaymentMode;

  /** ISO date string — the day the expense was incurred, not necessarily createdAt */
  @Column({ type: 'varchar' })
  expenseDate: string;

  @Column({ type: 'varchar', nullable: true })
  reference: string;      // bill / invoice / receipt number

  @Column({ type: 'varchar', nullable: true })
  addedBy: string;        // user name who recorded it

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
