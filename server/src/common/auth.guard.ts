import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private auth: AuthService) {}
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (!token) throw new UnauthorizedException('未登录');
    try { req.user = this.auth.verify(token); return true; }
    catch { throw new UnauthorizedException('登录已过期'); }
  }
}
