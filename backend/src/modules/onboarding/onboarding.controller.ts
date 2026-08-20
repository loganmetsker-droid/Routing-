import { Body, Controller, Get, Param, Put, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { SetOnboardingChampionDto } from './dto/set-onboarding-champion.dto';
import { UpdateOnboardingProgressDto } from './dto/update-onboarding-progress.dto';
import { OnboardingActor, OnboardingService } from './onboarding.service';

@ApiTags('onboarding')
@ApiBearerAuth('JWT-auth')
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('catalog')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER', 'VIEWER')
  catalog(@Req() req: { user: OnboardingActor }) {
    return { modules: this.onboarding.getCatalog(req.user) };
  }

  @Get('progress/me')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER', 'VIEWER')
  async myProgress(@Req() req: { user: OnboardingActor }) {
    return { progress: await this.onboarding.getMyProgress(req.user) };
  }

  @Put('progress/:moduleKey')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'DRIVER', 'VIEWER')
  async updateProgress(
    @Param('moduleKey') moduleKey: string,
    @Body() dto: UpdateOnboardingProgressDto,
    @Req() req: { user: OnboardingActor },
  ) {
    return { progress: await this.onboarding.updateProgress(moduleKey, dto, req.user) };
  }

  @Put('champion')
  @Roles('OWNER', 'ADMIN')
  async setChampion(@Body() dto: SetOnboardingChampionDto, @Req() req: { user: OnboardingActor }) {
    return this.onboarding.setChampion(dto, req.user);
  }

  @Get('readiness')
  @Roles('OWNER', 'ADMIN', 'DISPATCHER', 'VIEWER')
  async readiness(@Req() req: { user: OnboardingActor }) {
    return { readiness: await this.onboarding.getReadiness(req.user) };
  }

  @Get('team-progress')
  @Roles('OWNER', 'ADMIN')
  async teamProgress(@Req() req: { user: OnboardingActor }) {
    return { members: await this.onboarding.getTeamProgress(req.user) };
  }
}
