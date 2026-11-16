import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { store } from '../common/store';
import { config } from '../common/config';
import { LoginDto, LoginResult } from '../../../shared/types';

@Injectable()
export class AuthService {
  constructor(private jwt: JwtService) {}

  /** 本地测试账号登录：用户名不存在则自动注册（验证期免密码门槛） */
  async login(dto: LoginDto): Promise<LoginResult> {
    if (!dto.username || dto.username.trim().length < 2) {
      throw new Error('用户名至少 2 个字符');
    }
    let user = await store.findUserByUsername(dto.username.trim());
    let isNewUser = false;
    if (!user) {
      user = await store.createUser({
        username: dto.username.trim(),
        password: dto.password || '',
        nickname: dto.username.trim(),
        unionid: null
      });
      isNewUser = true;
    }
    const token = this.jwt.sign({ uid: user.uid, username: user.username });
    return { uid: user.uid, token, nickname: user.nickname, isNewUser };
  }

  /** 预留：微信登录（资质就绪后实现 code2session → unionid → uid） */
  async wxLogin(_provider: 'wx-mini' | 'wx-web', _code: string): Promise<LoginResult> {
    throw new Error('微信登录待资质就绪后开放，当前请使用本地测试账号');
  }

  verify(token: string): { uid: number; username: string } {
    return this.jwt.verify(token);
  }
}
