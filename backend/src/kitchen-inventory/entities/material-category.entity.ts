import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('material_categories')
export class MaterialCategory { @PrimaryGeneratedColumn('uuid') id: string; @Column({ unique: true }) name: string; @Column({ default: true }) active: boolean; @CreateDateColumn() createdAt: Date; }
