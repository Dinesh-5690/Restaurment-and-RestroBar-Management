import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { OrderType, OrderStatus, PaymentMethod, SettlementStatus } from '../../common/enums';
import { OrderItem } from './order-item.entity';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  billNo: string;

  @Column({ type: 'varchar' })
  orderType: OrderType;

  @Column({ nullable: true })
  tableId: string;

  @Column({ type: 'varchar', nullable: true })
  tableNumber: string;

  @Column({ type: 'varchar', default: OrderStatus.CREATED })
  status: OrderStatus;

  @Column({ type: 'float', default: 0 })
  subtotal: number;

  @Column({ type: 'float', default: 0 })
  taxAmount: number;

  @Column({ type: 'float', default: 0 })
  grossAmount: number;

  @Column({ type: 'float', default: 0 })
  discountAmount: number;

  @Column({ type: 'varchar', nullable: true })
  discountType: string;

  @Column({ type: 'float', nullable: true })
  discountValue: number;

  @Column({ type: 'varchar', nullable: true })
  couponCode: string;

  @Column({ type: 'varchar', nullable: true })
  couponId: string;

  @Column({ type: 'float', default: 0 })
  totalAmount: number;

  @Column({ type: 'varchar', default: SettlementStatus.UNPAID })
  settlementStatus: SettlementStatus;

  @Column({ type: 'varchar', default: PaymentMethod.UNKNOWN })
  paymentMethod: PaymentMethod;

  @Column({ nullable: true })
  settledAt: Date;

  @Column({ nullable: true })
  refundedAt: Date;

  @Column({ nullable: true })
  refundReason: string;

  @Column({ nullable: true })
  customerName: string;

  @Column({ nullable: true })
  customerPhone: string;

  @Column({ nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  notes: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true, eager: true })
  items: OrderItem[];

  @Column({ nullable: true })
  approvedBy: string;

  @Column({ nullable: true })
  approvedAt: Date;

  @Column({ nullable: true })
  completedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
