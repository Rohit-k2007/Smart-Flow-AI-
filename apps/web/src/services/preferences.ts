import { supabase } from './supabase'

export type UserPreferences = {
  theme: 'dark' | 'light'
  notifications: boolean
  showDemoLabels: boolean
  scenario: string
  controller: string
  showDirectionLabels: boolean
}

export const defaultUserPreferences: UserPreferences = {
  theme: 'dark',
  notifications: true,
  showDemoLabels: true,
  scenario: 'Normal Traffic',
  controller: 'Adaptive AI',
  showDirectionLabels: true,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export async function loadUserPreferences(userId: string): Promise<UserPreferences> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase
    .from('user_preferences')
    .select('preferences')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw new Error(`Could not load preferences: ${error.message}`)
  if (!data || !isRecord(data.preferences)) return defaultUserPreferences
  const saved = data.preferences
  return {
    theme: saved.theme === 'light' ? 'light' : 'dark',
    notifications: typeof saved.notifications === 'boolean' ? saved.notifications : defaultUserPreferences.notifications,
    showDemoLabels: typeof saved.showDemoLabels === 'boolean' ? saved.showDemoLabels : defaultUserPreferences.showDemoLabels,
    scenario: typeof saved.scenario === 'string' ? saved.scenario : defaultUserPreferences.scenario,
    controller: typeof saved.controller === 'string' ? saved.controller : defaultUserPreferences.controller,
    showDirectionLabels: typeof saved.showDirectionLabels === 'boolean' ? saved.showDirectionLabels : defaultUserPreferences.showDirectionLabels,
  }
}

export async function saveUserPreferences(
  userId: string,
  preferences: UserPreferences,
): Promise<void> {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase
    .from('user_preferences')
    .upsert({ user_id: userId, preferences }, { onConflict: 'user_id' })
  if (error) throw new Error(`Could not save preferences: ${error.message}`)
}
