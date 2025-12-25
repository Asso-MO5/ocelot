export type SettingValueType = 'string' | 'number' | 'boolean' | 'json';

export interface MuseumSetting {
  id: string;
  key: string;
  value: string;
  value_type: SettingValueType;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpsertSettingBody {
  key: string;
  value: string | number | boolean | object;
  value_type?: SettingValueType;
  description?: string;
}

export interface GetSettingsQuery {
  key?: string;
}

export type ParsedSettingValue = string | number | boolean | object;
