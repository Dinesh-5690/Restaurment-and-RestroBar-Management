import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ReservationStatus } from '../../common/enums';

@Entity('reservations')
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  customerName: string;

  @Column({ type: 'varchar', nullable: true })
  customerPhone: string;

  @Column({ type: 'int' })
  partySize: number;

  // YYYY-MM-DD
  @Column({ type: 'varchar' })
  reservationDate: string;

  // HH:mm
  @Column({ type: 'varchar' })
  reservationTime: string;

  @Column({ type: 'varchar', nullable: true })
  tableId: string;

  @Column({ type: 'varchar', nullable: true })
  tableNumber: string;

  @Column({ type: 'varchar', default: ReservationStatus.PENDING })
  status: ReservationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  specialRequest: string;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
