import { FormControl } from '@angular/forms';
import { Fail, Failable } from 'picsur-shared/dist/types';
import { Compare } from './compare.validator';
import {
  CreatePasswordError,
  CreateUsernameError,
  PasswordValidators,
  UsernameValidators
} from './user-validators';
import { UserPassModel } from './userpass.model';

export class RegisterControl {
  public username = new FormControl('', UsernameValidators);
  public password = new FormControl('', PasswordValidators);
  public passwordConfirm = new FormControl('', [
    ...PasswordValidators,
    Compare(this.password),
  ]);

  public get usernameError() {
    return CreateUsernameError(this.username.errors);
  }

  public get passwordError() {
    return CreatePasswordError(this.password.errors);
  }

  public get passwordConfirmError() {
    return CreatePasswordError(this.passwordConfirm.errors);
  }

  public getData(): Failable<UserPassModel> {
    if (
      this.username.errors ||
      this.password.errors ||
      this.passwordConfirm.errors
    )
      return Fail('Invalid username or password');
    else return this.getRawData();
  }

  public getRawData(): UserPassModel {
    return {
      username: this.username.value,
      password: this.password.value,
    };
  }

  public putData(data: UserPassModel) {
    this.username.setValue(data.username);
    this.password.setValue(data.password);
    this.passwordConfirm.setValue(data.password);
  }
}
