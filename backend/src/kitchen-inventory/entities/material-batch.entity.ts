import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
@Entity('material_batches')
export class MaterialBatch { @PrimaryGeneratedColumn('uuid') id: string; @Column() materialId: string; @Column() batchCode: string; @Column({ type: 'decimal', precision: 12, scale: 3 }) quantity: number; @Column({ nullable: true }) supplierName: string; @CreateDateColumn() receivedAt: Date; }
