import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

@Entity('item_addons')
@Unique('uq_item_addon', ['itemId', 'addonId'])
export class ItemAddon {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  itemId: string;

  @Column()
  addonId: string;

  @CreateDateColumn()
  createdAt: Date;
}
