import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/**
 * One module per domain. This is the only module in the Phase 3 scaffold; the
 * persistence-backed modules arrive with Prisma (AI_WORKFLOW.md section 7 order).
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}