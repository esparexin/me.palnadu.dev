import {Module} from '@nestjs/common';
import {PrismaService} from './prisma.service.js';

/**
 * Persistence module. Exported rather than global: a module that touches the
 * database imports it explicitly, so the dependency is visible in that module's
 * imports instead of arriving implicitly (ARCHITECTURE.md section 6).
 */
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
