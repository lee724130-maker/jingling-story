import { Body, Controller, Post, Get, Req, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiResponse, LoginDto, LoginResult } from '../../../shared/types';

@Controller('api/auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  async login(@Body() dto: LoginDto): Promise<ApiResponse<LoginResult>> {
    try {
      return { code: 0, message: 'ok', data: await this.auth.login(dto) };
    } catch (e: any) {
      return { code: 3001, message: e.message, data: null as any };
    }
  }

  @Post('wx-mini/login')
  async wxMini(@Body() body: { code: string }): Promise<ApiResponse<LoginResult>> {
    try { return { code: 0, message: 'ok', data: await this.auth.wxLogin('wx-mini', body.code) }; }
    catch (e: any) { return { code: 3001, message: e.message, data: null as any }; }
  }

  @Post('wx-web/login')
  async wxWeb(@Body() body: { code: string }): Promise<ApiResponse<LoginResult>> {
    try { return { code: 0, message: 'ok', data: await this.auth.wxLogin('wx-web', body.code) }; }
    catch (e: any) { return { code: 3001, message: e.message, data: null as any }; }
  }

  @Get('me')
  me(@Req() req: any): ApiResponse<any> {
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    try { return { code: 0, message: 'ok', data: this.auth.verify(token) }; }
    catch { throw new UnauthorizedException('登录已过期'); }
  }
}
