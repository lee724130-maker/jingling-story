import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../common/auth.guard';

@Module({ imports: [AuthModule], controllers: [GameController], providers: [AuthGuard, GameService] })
export class GameModule {}
