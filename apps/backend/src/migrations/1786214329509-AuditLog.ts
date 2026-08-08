import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLog1786214329509 implements MigrationInterface {
    name = 'AuditLog1786214329509'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."audit_logs_action_enum" AS ENUM('created', 'updated', 'deleted', 'approved', 'rejected', 'assigned', 'cancelled', 'issued', 'role_changed', 'activated', 'deactivated', 'login', 'login_failed', 'password_reset', 'uploaded', 'downloaded', 'access_changed', 'viewed')`);
        await queryRunner.query(`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "actorId" character varying, "actorName" character varying, "actorRole" character varying, "action" "public"."audit_logs_action_enum" NOT NULL, "entityType" character varying NOT NULL, "entityId" character varying, "entityLabel" character varying, "subjectId" character varying, "subjectName" character varying, "changes" text, "summary" text, "method" character varying, "path" text, "ip" character varying, "userAgent" text, "statusCode" integer, "success" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2dc33f7f3c22e2e7badafca1d1" ON "audit_logs"  ("actorId") `);
        await queryRunner.query(`CREATE INDEX "IDX_cee5459245f652b75eb2759b4c" ON "audit_logs"  ("action") `);
        await queryRunner.query(`CREATE INDEX "IDX_01993ae76b293d3b866cc3a125" ON "audit_logs"  ("entityType") `);
        await queryRunner.query(`CREATE INDEX "IDX_f23279fad63453147a8efb46cf" ON "audit_logs"  ("entityId") `);
        await queryRunner.query(`CREATE INDEX "IDX_c69efb19bf127c97e6740ad530" ON "audit_logs"  ("createdAt") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_c69efb19bf127c97e6740ad530"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f23279fad63453147a8efb46cf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_01993ae76b293d3b866cc3a125"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cee5459245f652b75eb2759b4c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2dc33f7f3c22e2e7badafca1d1"`);
        await queryRunner.query(`DROP TABLE "audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."audit_logs_action_enum"`);
    }

}
