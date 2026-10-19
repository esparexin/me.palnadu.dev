import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {ExperienceController} from './experience.controller.js';
import {ExperienceService} from './experience.service.js';

/** One module per domain collection (ARCHITECTURE.md section 5). */
@Module({
  imports: [PrismaModule],
  controllers: [ExperienceController],
  providers: [ExperienceService],
  exports: [ExperienceService],
})
export class ExperienceModule {}
