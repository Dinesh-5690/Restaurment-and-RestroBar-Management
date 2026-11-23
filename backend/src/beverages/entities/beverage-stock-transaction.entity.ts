import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('beverage_stock_transactions')
export class BeverageStockTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() beverageId: string;
  @Column({ type: 'float' }) quantityMl: number;
  @Column() transactionType: 'SALE_DEDUCTION' | 'ADJUSTMENT' | 'RESTOCK' | 'CANCELLATION_RESTORE' | 'REJECTION_RESTORE';
  @Column({ nullable: true }) referenceId: string;
  @CreateDateColumn() createdAt: Date;
}
