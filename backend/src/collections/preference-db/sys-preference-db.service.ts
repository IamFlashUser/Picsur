import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DecodedSysPref,
  PrefValueType,
  PrefValueTypeStrings
} from 'picsur-shared/dist/dto/preferences.dto';
import { SysPreference } from 'picsur-shared/dist/dto/sys-preferences.enum';
import { AsyncFailable, Fail, HasFailed } from 'picsur-shared/dist/types';
import { Repository } from 'typeorm';
import {
  SysPreferenceList,
  SysPreferenceValueTypes
} from '../../models/constants/syspreferences.const';
import {
  ESysPreferenceBackend,
  ESysPreferenceSchema
} from '../../models/entities/sys-preference.entity';
import { MutexFallBack } from '../../models/util/mutex-fallback';
import { PreferenceCommonService } from './preference-common.service';
import { PreferenceDefaultsService } from './preference-defaults.service';

@Injectable()
export class SysPreferenceService {
  private readonly logger = new Logger('SysPreferenceService');

  constructor(
    @InjectRepository(ESysPreferenceBackend)
    private sysPreferenceRepository: Repository<ESysPreferenceBackend>,
    private defaultsService: PreferenceDefaultsService,
    private prefCommon: PreferenceCommonService,
  ) {}

  public async setPreference(
    key: string,
    value: PrefValueType,
  ): AsyncFailable<DecodedSysPref> {
    // Validate
    let sysPreference = await this.validateSysPref(key, value);
    if (HasFailed(sysPreference)) return sysPreference;

    // Set
    try {
      // Upsert here, because we want to create a new record if it does not exist
      await this.sysPreferenceRepository.upsert(sysPreference, {
        conflictPaths: ['key'],
      });
    } catch (e) {
      return Fail(e);
    }

    // Return
    return {
      key: sysPreference.key,
      value,
      // key has to be valid here, we validated it
      type: SysPreferenceValueTypes[key as SysPreference],
    };
  }

  public async getPreference(key: string): AsyncFailable<DecodedSysPref> {
    // Validate
    let validatedKey = this.prefCommon.validatePrefKey(key, SysPreference);
    if (HasFailed(validatedKey)) return validatedKey;

    return MutexFallBack(
      'fetchSysPrefrence',
      async () => {
        let existing: ESysPreferenceBackend | null;
        try {
          existing = await this.sysPreferenceRepository.findOne({
            where: { key: validatedKey as SysPreference },
            cache: 60000,
          });
          if (!existing) return null;
        } catch (e) {
          return Fail(e);
        }

        // Validate
        const result = ESysPreferenceSchema.safeParse(existing);
        if (!result.success) {
          return Fail(result.error);
        }

        // Return
        return this.prefCommon.validateAndUnpackPref(
          result.data,
          SysPreference,
          SysPreferenceValueTypes,
        );
      },
      () => this.saveDefault(validatedKey as SysPreference),
    );
  }

  public async getStringPreference(key: string): AsyncFailable<string> {
    return this.getPreferencePinned(key, 'string') as AsyncFailable<string>;
  }

  public async getNumberPreference(key: string): AsyncFailable<number> {
    return this.getPreferencePinned(key, 'number') as AsyncFailable<number>;
  }

  public async getBooleanPreference(key: string): AsyncFailable<boolean> {
    return this.getPreferencePinned(key, 'boolean') as AsyncFailable<boolean>;
  }

  private async getPreferencePinned(
    key: string,
    type: PrefValueTypeStrings,
  ): AsyncFailable<PrefValueType> {
    let pref = await this.getPreference(key);
    if (HasFailed(pref)) return pref;
    if (pref.type !== type) return Fail('Invalid preference type');

    return pref.value;
  }

  public async getAllPreferences(): AsyncFailable<DecodedSysPref[]> {
    // TODO: We are fetching each value invidually, we should fetch all at once
    let internalSysPrefs = await Promise.all(
      SysPreferenceList.map((key) => this.getPreference(key)),
    );
    if (internalSysPrefs.some((pref) => HasFailed(pref))) {
      return Fail('Could not get all preferences');
    }

    return internalSysPrefs as DecodedSysPref[];
  }

  // Private

  private async saveDefault(
    key: SysPreference, // Force enum here because we dont validate
  ): AsyncFailable<DecodedSysPref> {
    return this.setPreference(key, this.defaultsService.sysDefaults[key]());
  }

  private async validateSysPref(
    key: string,
    value: PrefValueType,
  ): AsyncFailable<ESysPreferenceBackend> {
    const validated = await this.prefCommon.validatePref(
      key,
      value,
      SysPreference,
      SysPreferenceValueTypes,
    );
    if (HasFailed(validated)) return validated;

    let verifySysPreference = new ESysPreferenceBackend();
    verifySysPreference.key = validated.key;
    verifySysPreference.value = validated.value;

    // It should already be valid, but these two validators might go out of sync
    const result = ESysPreferenceSchema.safeParse(verifySysPreference);
    if (!result.success) {
      return Fail(result.error);
    }

    return result.data;
  }
}
