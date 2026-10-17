import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderItemStatus } from '../../common/enums';
import { Order } from './order.entity';
import { OrderItemAddon } from './order-item-addon.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  menuItemId: string;

  @Column()
  menuItemName: string;

  @Column()
  quantity: number;

  @Column({ type: 'float' })
  unitPrice: number;

  @Column({ type: 'float' })
  lineTotal: number;

  @Column({ type: 'float', default: 0 })
  addonTotal: number;

  @Column({ type: 'text', nullable: true })
  addonSummary: string;

  @Column({ nullable: true })
  sourceBillNo: string;

  @Column({ type: 'varchar', default: OrderItemStatus.PENDING })
  status: OrderItemStatus;

  @Column({ nullable: true })
  kitchenStation: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  cookingStartedAt: Date;

  @Column({ nullable: true })
  readyAt: Date;

  @Column({ nullable: true })
  servedAt: Date;

  @OneToMany(() => OrderItemAddon, (addon) => addon.orderItem, { cascade: true, eager: true })
  addOns: OrderItemAddon[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
