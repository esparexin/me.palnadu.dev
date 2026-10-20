import {Module} from '@nestjs/common';
import {PrismaModule} from '../../prisma/prisma.module.js';
import {AdminAuthModule} from '../auth/admin.module.js';
import {MediaController} from './media.controller.js';
import {MediaService} from './media.service.js';

/** Direct-to-provider media library (ADR-0010 4). */
@Module({
  imports: [PrismaModule, AdminAuthModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
