import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PlayerService } from './player.service';
import { AuthGuard } from '../common/auth.guard';
import { ApiResponse, SaveResult, SaveSubmitDto } from '../../../shared/types';

function uidOf(req: any): number { return req.user.uid; }

@Controller('api/player')
@UseGuards(AuthGuard)
export class PlayerController {
  constructor(private player: PlayerService) {}

  @Get('save')
  async getSave(@Req() req: any): Promise<ApiResponse<SaveResult>> {
    return { code: 0, message: 'ok', data: await this.player.getSave(uidOf(req)) };
  }

  @Post('save')
  async submitSave(@Req() req: any, @Body() dto: SaveSubmitDto): Promise<ApiResponse<SaveResult>> {
    const r = await this.player.submitSave(uidOf(req), dto);
    return { code: r.code, message: r.message, data: r.data as SaveResult };
  }
}
