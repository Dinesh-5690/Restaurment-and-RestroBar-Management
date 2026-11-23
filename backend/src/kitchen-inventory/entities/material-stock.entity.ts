import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
@Entity('material_stock')
export class MaterialStock { @PrimaryColumn() materialId: string; @Column({ type: 'decimal', precision: 12, scale: 3, default: 0 }) availableQuantity: number; @UpdateDateColumn() updatedAt: Date; }
