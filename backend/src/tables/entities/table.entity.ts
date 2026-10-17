import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { TableStatus } from '../../common/enums';

@Entity('tables')
export class Table {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  tableNumber: string;

  @Column({ unique: true, nullable: true })
  qrCodeId: string;

  @Column({ nullable: true, type: 'text' })
  qrCodeUrl: string;

  @Column({ nullable: true, type: 'text' })
  qrCodeImage: string; // base64 data URI

  @Column({ type: 'varchar', default: TableStatus.FREE })
  status: TableStatus;

  @Column({ nullable: true })
  currentOrderId: string;

  @Column({ default: 4 })
  capacity: number;

  @Column({ nullable: true })
  location: string; // e.g. "Ground Floor", "Terrace"

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
