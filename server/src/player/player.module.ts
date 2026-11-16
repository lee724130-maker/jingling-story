import { Module } from '@nestjs/common';
import { PlayerService } from './player.service';
import { PlayerController } from './player.controller';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../common/auth.guard';

@Module({ imports: [AuthModule], controllers: [PlayerController], providers: [PlayerService, AuthGuard], exports: [PlayerService] })
export class PlayerModule {}
