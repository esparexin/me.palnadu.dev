import {Controller, Get} from '@nestjs/common';
import {PublicExperienceSchema} from '@me-palnadu/contracts';
import {type ExperienceService} from './experience.service.js';

/**
 * Public read endpoint.
 *
 * Only reads are exposed over HTTP in this phase. Writes are service methods until
 * the session guard from Phase 6C exists, because a write route without a guard is
 * an unauthenticated write path (SECURITY.md section 2).
 *
 * The response is validated against the contract on the way out, so a drift
 * between the persistence layer and the published contract fails here rather than
 * in a browser.
 */
@Controller('api/experience')
export class ExperienceController {
  constructor(private readonly experience: ExperienceService) {}

  @Get()
  async listPublished() {
    const records = await this.experience.listPublished();
    return records.map((record) => PublicExperienceSchema.parse(record));
  }
}
