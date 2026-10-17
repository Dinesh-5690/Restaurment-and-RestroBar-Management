import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum CouponDiscountType {
  PERCENT = 'PERCENT',
  FLAT = 'FLAT',
}

@Entity('coupons')
export class Coupon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  code: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', default: CouponDiscountType.PERCENT })
  discountType: CouponDiscountType;

  @Column({ type: 'float' })
  discountValue: number;

  @Column({ type: 'float', default: 0 })
  minOrderAmount: number;

  @Column({ type: 'float', nullable: true })
  maxDiscountAmount: number;

  @Column({ type: 'int', nullable: true })
  usageLimit: number;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'datetime', nullable: true })
  startsAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endsAt: Date;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
