import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-strategy';
import { EUser } from 'picsur-shared/dist/entities/user.entity';
import { EUserBackend2EUser } from '../../../models/transformers/user.transformer';
import { GuestService } from '../guest.service';
import { ReqType } from './reqtype';

class GuestPassportStrategy extends Strategy {
  // Will be overridden by the nest implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async validate(req: ReqType): Promise<any> {
    return undefined;
  }

  override async authenticate(req: ReqType) {
    const user = await this.validate(req);
    this.success(user);
  }
}

@Injectable()
export class GuestStrategy extends PassportStrategy(
  GuestPassportStrategy,
  'guest',
) {
  constructor(private readonly guestService: GuestService) {
    super();
  }

  // Return the guest user created by the guestservice
  override async validate(): Promise<EUser> {
    return EUserBackend2EUser(await this.guestService.getGuestUser());
  }
}
