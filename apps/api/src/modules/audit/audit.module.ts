import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AuditController, AuditService} from './audit.controller.js';

/** Read-only audit trail (ADR-0010 6). */
@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
