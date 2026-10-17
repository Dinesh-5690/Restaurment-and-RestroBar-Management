import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  LATE = 'LATE',
  HALF_DAY = 'HALF_DAY',
  ABSENT = 'ABSENT',
  LEAVE = 'LEAVE',
}

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  userName: string;

  @Column({ type: 'varchar' })
  userRole: string;

  // YYYY-MM-DD
  @Column({ type: 'varchar' })
  attendanceDate: string;

  @Column({ type: 'datetime', nullable: true })
  checkInAt: Date;

  @Column({ type: 'datetime', nullable: true })
  checkOutAt: Date;

  @Column({ type: 'int', default: 0 })
  workedMinutes: number;

  @Column({ type: 'varchar', default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ type: 'boolean', default: false })
  isManual: boolean;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'varchar', nullable: true })
  createdBy: string;

  @Column({ type: 'varchar', nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
