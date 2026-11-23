import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
@Entity('beverage_inventory')
export class BeverageInventory {
  @PrimaryColumn() beverageId: string;
  @Column({ type: 'float', default: 0 }) availableMl: number;
  @Column({ type: 'float', default: 0 }) lowStockThreshold: number;
  @UpdateDateColumn() updatedAt: Date;
}
