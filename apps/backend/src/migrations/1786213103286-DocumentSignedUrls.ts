import { MigrationInterface, QueryRunner } from "typeorm";

export class DocumentSignedUrls1786213103286 implements MigrationInterface {
    name = 'DocumentSignedUrls1786213103286'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" ADD "storagePath" text`);
        await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "url" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "documents" ALTER COLUMN "url" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "storagePath"`);
    }

}
