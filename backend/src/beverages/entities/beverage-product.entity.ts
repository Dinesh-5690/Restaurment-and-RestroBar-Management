import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
@Entity('beverage_products')
export class BeverageProduct {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() categoryId: string;
  @Column() brand: string;
  @Column() productName: string;
  @Column({ type: 'int', default: 750 }) bottleSize: number;
  @Column({ type: 'float', default: 0 }) abv: number;
  @Column({ nullable: true }) imagePath: string;
  @Column({ type: 'float', default: 0 }) bottlePrice: number;
  @Column({ type: 'float', default: 0 }) price30ml: number;
  @Column({ type: 'float', default: 0 }) price60ml: number;
  @Column({ type: 'float', default: 0 }) price90ml: number;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
