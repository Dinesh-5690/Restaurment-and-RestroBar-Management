import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', default: UserRole.WAITER })
  role: UserRole;

  @Column({ type: 'varchar', length: 20, nullable: true })
  salaryType?: 'MONTHLY' | 'DAILY' | 'WEEKLY' | 'BIWEEKLY';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  salaryAmount?: number;

  @Column({ type: 'simple-array', nullable: true })
  accessRights?: string[];

  @Column({ type: 'text', nullable: true })
  basicDetails?: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
