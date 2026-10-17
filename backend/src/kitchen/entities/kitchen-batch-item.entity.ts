import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { KitchenBatch } from './kitchen-batch.entity';

@Entity('kitchen_batch_items')
export class KitchenBatchItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  batchId: string;

  @ManyToOne(() => KitchenBatch, (batch) => batch.batchItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'batchId' })
  batch: KitchenBatch;

  @Column()
  orderItemId: string;

  @Column()
  menuItemName: string;

  @Column()
  quantity: number;

  @Column({ nullable: true })
  kitchenStation: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  addonSummary: string;

  @Column({ type: 'json', nullable: true })
  addOns: Array<{ id?: string; addonName: string; quantity?: number; unitPrice?: number; lineTotal?: number }>;
}
