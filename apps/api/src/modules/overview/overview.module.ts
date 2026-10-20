import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {OverviewController, OverviewService} from './overview.controller.js';

/** Dashboard counters, computed on request from the database (ADR-0010 6). */
@Module({
  imports: [PrismaModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
