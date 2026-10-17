import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { KitchenBatchStatus } from '../../common/enums';
import { KitchenBatchItem } from './kitchen-batch-item.entity';

@Entity('kitchen_batches')
export class KitchenBatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column({ nullable: true })
  orderBillNo: string;

  @Column({ nullable: true })
  orderType: string;

  @Column({ type: 'varchar', nullable: true })
  tableNumber: string;

  @Column()
  batchNumber: number;

  @Column({ type: 'varchar', default: KitchenBatchStatus.WAITING })
  status: KitchenBatchStatus;

  @Column({ nullable: true })
  firedBy: string;

  @Column({ nullable: true })
  firedAt: Date;

  @Column({ nullable: true })
  doneAt: Date;

  @OneToMany(() => KitchenBatchItem, (item) => item.batch, { cascade: true, eager: true })
  batchItems: KitchenBatchItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
