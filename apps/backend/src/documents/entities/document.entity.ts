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

  /**
   * Legacy: a directly-stored URL. Kept nullable so rows created before signed
   * URLs still render. New uploads populate `storagePath` instead.
   */
  @Column({ type: 'text', nullable: true })
  url: string | null;

  /**
   * Object key inside the storage bucket, e.g. `documents/<employeeId>/<file>`.
   * The download link is minted per request and expires — a permanent public
   * URL to someone's contract or payslip is not something to store.
   */
  @Column({ type: 'text', nullable: true })
  storagePath: string | null;

  @Column({ nullable: true })
  mimeType: string;

  @Column({ type: 'int', nullable: true })
  size: number;

  @Column({ nullable: true })
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
