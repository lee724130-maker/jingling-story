import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../common/auth.guard';
import { GameService } from './game.service';
import { ApiResponse, BattleSettleDto, CaptureSettleDto } from '../../../shared/types';

/* 服务端权威结算：战斗/捕获奖励由服务端按共享规则重算，客户端只上报上下文 */
@Controller('api/game')
@UseGuards(AuthGuard)
export class GameController {
  constructor(private readonly game: GameService) {}

  @Post('battle/settle')
  async settle(@Req() req: any, @Body() dto: BattleSettleDto): Promise<ApiResponse<any>> {
    const r = await this.game.settleBattle(req.user.uid, dto);
    return { code: r.code, message: r.message, data: r.data };
  }

  @Post('capture')
  async capture(@Req() req: any, @Body() dto: CaptureSettleDto): Promise<ApiResponse<any>> {
    const r = await this.game.settleCapture(req.user.uid, dto);
    return { code: r.code, message: r.message, data: r.data };
  }
}
