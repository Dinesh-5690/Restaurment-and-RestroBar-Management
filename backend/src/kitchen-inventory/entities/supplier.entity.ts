import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('suppliers')
export class Supplier { @PrimaryGeneratedColumn('uuid') id: string; @Column({ unique: true, collation: 'utf8mb4_bin' }) name: string; @Column({ nullable: true }) phone: string; @Column({ nullable: true }) email: string; @CreateDateColumn() createdAt: Date; }
