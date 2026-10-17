import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';

@Entity('order_item_addons')
export class OrderItemAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem, (orderItem) => orderItem.addOns, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column({ nullable: true })
  addonId: string;

  @Column()
  addonName: string;

  @Column({ type: 'float', default: 0 })
  unitPrice: number;

  @Column({ default: 1 })
  quantity: number;

  @Column({ type: 'float', default: 0 })
  lineTotal: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
