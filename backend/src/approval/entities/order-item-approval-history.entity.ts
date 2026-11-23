import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('order_item_approval_history')
export class OrderItemApprovalHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @Column()
  orderItemId: string;

  @Column()
  action: string;

  @Column()
  actorUserId: string;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text' })
  beforeSnapshot: string;

  @Column({ type: 'text', nullable: true })
  afterSnapshot: string;

  @CreateDateColumn()
  createdAt: Date;
}
