import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bottle_qr_codes')
export class BottleQRCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) bottleId: string;
  @Column({ unique: true }) qrCode: string;
  @Column({ type: 'text' }) qrData: string;
  @Column({ type: 'text', nullable: true }) qrImageDataUrl: string;
  @CreateDateColumn() createdAt: Date;
}
