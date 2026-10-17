import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('category_addons')
@Unique('uq_category_addon', ['categoryId', 'addonId'])
export class CategoryAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  categoryId: string;

  @Column()
  addonId: string;

  @CreateDateColumn()
  createdAt: Date;
}
