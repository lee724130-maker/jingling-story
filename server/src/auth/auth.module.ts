import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { config } from '../common/config';

@Module({
  imports: [JwtModule.register({ secret: config.jwtSecret, signOptions: { expiresIn: '7d' } })],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService]
})
export class AuthModule {}
