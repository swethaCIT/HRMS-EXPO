import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {
    const secret = config.get<string>('JWT_SECRET');
    // Fail closed. A default here would be asymmetric with AuthModule/OnboardingModule,
    // which sign with `JWT_SECRET` and no fallback: if the variable were ever missing,
    // verification would still accept any token signed with the hardcoded,
    // source-visible string — i.e. anyone could forge a token for any account.
    if (!secret) {
      throw new Error('JWT_SECRET is not set — refusing to start with an insecure default.');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  /**
   * Runs on EVERY authenticated request. A raw DB lookup here makes auth the hard
   * throughput ceiling of the whole API under load — every request queues on the
   * connection pool just to validate the token. The token is already
   * cryptographically verified; we only need to confirm the account still exists
   * and is active. Cache that check for 30s so bursts of requests from the same
   * user skip the database — a deactivated user is still locked out within the TTL.
   */
  async validate(payload: { sub: string; email: string }) {
    const key = `auth:user:${payload.sub}`;
    const cached = await this.cache.get(key);
    if (cached) return cached;

    const user = await this.usersService.findOne(payload.sub);
    if (!user || !user.isActive) throw new UnauthorizedException();
    await this.cache.set(key, user, 30_000);
    return user;
  }
}
