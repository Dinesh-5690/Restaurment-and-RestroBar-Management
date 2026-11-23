import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bottle_movement_logs')
export class BottleMovementLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() bottleId: string;
  @Column({ nullable: true }) beverageId: string;
  @Column({ type: 'varchar' }) operationType: 'IN' | 'OUT';
  @Column({ type: 'float' }) quantityMl: number;
  @Column({ type: 'float' }) previousStockMl: number;
  @Column({ type: 'float' }) updatedStockMl: number;
  @Column({ type: 'varchar', nullable: true }) previousStatus: string;
  @Column({ type: 'varchar', nullable: true }) updatedStatus: string;
  @Column() performedBy: string;
  @Column({ type: 'text', nullable: true }) remarks: string;
  @CreateDateColumn() performedAt: Date;
}
