import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column()
  employeeId: string;

  @Column()
  name: string;

  @Column({ default: 'other' })
  category: string; // id | contract | payslip | certificate | other

  @Column({ type: 'text' })
  url: string;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  size: number;

  @Column({ nullable: true })
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
