import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('material_suggestions')
export class MaterialSuggestion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() categoryId: string;
  @Column() categoryName: string;
  @Column() name: string;
  @Column({ default: false }) predefined: boolean;
  @CreateDateColumn() createdAt: Date;
}
