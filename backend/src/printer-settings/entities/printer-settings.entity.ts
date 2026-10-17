import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReceiptElementKey = 'logo' | 'name' | 'address' | 'contact';
export type ReceiptAlignment = 'left' | 'center' | 'right';
export type ReceiptElementPosition = { x: number; y: number };

@Entity('printer_settings')
export class PrinterSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  logoUrl: string;

  @Column()
  addressLine1: string;

  @Column()
  addressLine2: string;

  @Column()
  city: string;

  @Column()
  postalCode: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column({ type: 'float', default: 87 })
  receiptWidthMm: number;

  @Column({ type: 'int', default: 160 })
  headerHeightPx: number;

  @Column({ type: 'int', default: 40 })
  logoSizePx: number;

  @Column({ type: 'simple-json', default: () => `JSON_OBJECT('logo', 'left', 'name', 'center', 'address', 'center', 'contact', 'center')` })
  elementAlignments: Record<ReceiptElementKey, ReceiptAlignment>;

  @Column({ type: 'simple-json', default: () => `JSON_OBJECT('logo', JSON_OBJECT('x', 5, 'y', 6), 'name', JSON_OBJECT('x', 50, 'y', 54), 'address', JSON_OBJECT('x', 50, 'y', 83), 'contact', JSON_OBJECT('x', 50, 'y', 115))` })
  elementPositions: Record<ReceiptElementKey, ReceiptElementPosition>;

  @Column({ type: 'simple-json', default: () => `JSON_ARRAY('logo', 'name', 'address', 'contact')` })
  elementOrder: ReceiptElementKey[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
