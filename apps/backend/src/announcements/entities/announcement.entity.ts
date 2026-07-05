import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('announcements')
export class Announcement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ default: 'general' })
  category: string;

  @Column()
  authorId: string;

  @Column({ nullable: true })
  authorName: string;

  @Column({ default: false })
  pinned: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
