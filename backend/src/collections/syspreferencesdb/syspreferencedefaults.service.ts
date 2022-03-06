import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SysPreferences } from 'picsur-shared/dist/dto/syspreferences.dto';
import { generateRandomString } from 'picsur-shared/dist/util/random';
import { EnvJwtConfigService } from '../../config/jwt.config.service';

@Injectable()
export class SysPreferenceDefaultsService {
  private readonly logger = new Logger('SysPreferenceDefaultsService');

  constructor(private jwtConfigService: EnvJwtConfigService) {}

  public readonly defaults: {
    [key in SysPreferences]: () => string;
  } = {
    jwt_secret: () => {
      const envSecret = this.jwtConfigService.getJwtSecret();
      if (envSecret) {
        return envSecret;
      } else {
        this.logger.warn(
          'Since no JWT secret was provided, a random one will be generated and saved',
        );
        return generateRandomString(64);
      }
    },
    jwt_expires_in: () => this.jwtConfigService.getJwtExpiresIn() ?? '7d',
  };
}