import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('assets')
export class Asset {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  assetTag: string; // e.g. LAP-2041

  @Column()
  name: string; // e.g. MacBook Pro 14"

  @Column()
  category: string; // Laptop | Monitor | Phone | Accessory | Other

  @Column({ nullable: true })
  serialNumber: string;

  @Column({ default: 'Good' })
  condition: string; // Good | Fair | Damaged

  @Column({ default: 'assigned' })
  status: string; // assigned | returned

  @Column({ type: 'date', nullable: true })
  assignedDate: Date;

  @Index()
  @Column()
  employeeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
