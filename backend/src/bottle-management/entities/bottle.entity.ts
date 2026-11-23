import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('bottles')
export class Bottle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) bottleCode: string;
  @Column({ nullable: true }) beverageId: string;
  @Column({ nullable: true, default: 'Unknown' }) batchId: string;
  @Column({ nullable: true }) brand: string;
  @Column({ nullable: true }) productName: string;
  @Column({ type: 'int', nullable: true, default: 0 }) bottleSizeMl: number;
  @Column({ default: true }) authorized: boolean;
  @Column({ type: 'varchar', default: 'REGISTERED' }) status: 'UNREGISTERED' | 'REGISTERED' | 'IN_STOCK' | 'ISSUED_OUT' | 'OUT_OF_STOCK' | 'DEACTIVATED';
  @Column({ nullable: true }) registeredBy: string;
  @Column({ nullable: true }) registeredAt: Date;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
