// Settings section for dsh-web-terminal (registered into the official settings shell).

import { useSyncExternalStore } from 'react'

interface FormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: Record<string, unknown> | undefined
  revision: number | undefined
  writable: boolean
}

interface ConfigFormLike {
  getSnapshot(): FormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
}

export interface SettingsSectionProps {
  t?: (key: string, params?: Record<string, unknown>) => string
  form?: ConfigFormLike
}

const FALLBACK_FORM: ConfigFormLike = {
  getSnapshot: () => ({ status: 'unavailable', value: undefined, revision: undefined, writable: false }),
  subscribe: () => () => {},
  set: async () => false,
}

const TOOL_MODES = [
  { id: 'none', key: 'settings.tools.none' },
  { id: 'core', key: 'settings.tools.core' },
  { id: 'full', key: 'settings.tools.full' },
]

const POLICIES = [
  { id: 'all', key: 'settings.policy.all' },
  { id: 'intercepted', key: 'settings.policy.intercepted' },
  { id: 'off', key: 'settings.policy.off' },
]

function Switch(props: { checked: boolean; disabled: boolean; onChange: (next: boolean) => void; label: string }): JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.label}
      disabled={props.disabled}
      className="dshtp-settings-switch"
      data-checked={props.checked ? 'true' : 'false'}
      onClick={() => { props.onChange(!props.checked) }}
    >
      <span className="dshtp-settings-knob" />
    </button>
  )
}

function Row(props: { title: string; hint?: string; children: JSX.Element }): JSX.Element {
  return (
    <div className="dshtp-settings-row">
      <div className="dshtp-settings-copy">
        <div className="dshtp-settings-title">{props.title}</div>
        {props.hint === undefined ? null : <div className="dshtp-settings-hint">{props.hint}</div>}
      </div>
      <div className="dshtp-settings-control">{props.children}</div>
    </div>
  )
}

export function SettingsSection(props: SettingsSectionProps): JSX.Element {
  const t = props.t ?? ((key: string) => key)
  const form = props.form ?? FALLBACK_FORM
  const snapshot = useSyncExternalStore(
    (listener) => form.subscribe(listener),
    () => form.getSnapshot(),
  )
  if (props.form === undefined) {
    return <div className="dshtp-settings">{t('settings.unavailable')}</div>
  }
  const value = (snapshot.value ?? {}) as Record<string, unknown>
  const disabled = !snapshot.writable || snapshot.status !== 'ready'
  const bool = (key: string, fallback: boolean): boolean =>
    typeof value[key] === 'boolean' ? value[key] as boolean : fallback
  const num = (key: string, fallback: number): number =>
    typeof value[key] === 'number' ? value[key] as number : fallback
  const policy = typeof value.autoOpenPolicy === 'string' ? value.autoOpenPolicy : 'all'
  const toolMode = typeof value.exposeTools === 'string' ? value.exposeTools : 'none'
  const write = (field: string, next: unknown): void => { void form.set(field, next) }

  return (
    <div className="dshtp-settings">
      <h2 className="dshtp-settings-heading">{t('settings.title')}</h2>
      <p className="dshtp-settings-intro">{t('settings.intro')}</p>

      <div className="dshtp-settings-group">
        <div className="dshtp-settings-group-title">{t('settings.group.open')}</div>
        <Row title={t('settings.policy.title')} hint={t('settings.policy.hint')}>
          <div className="dshtp-settings-segments" role="radiogroup" aria-label={t('settings.policy.title')}>
            {POLICIES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={policy === option.id}
                disabled={disabled}
                className="dshtp-settings-segment"
                data-active={policy === option.id ? 'true' : 'false'}
                onClick={() => { write('autoOpenPolicy', option.id) }}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
        </Row>
        <Row title={t('settings.includeInteractive.title')} hint={t('settings.includeInteractive.hint')}>
          <Switch
            label={t('settings.includeInteractive.title')}
            checked={bool('autoOpenIncludeInteractive', true)}
            disabled={disabled}
            onChange={(next) => { write('autoOpenIncludeInteractive', next) }}
          />
        </Row>
        <Row title={t('settings.reopen.title')} hint={t('settings.reopen.hint')}>
          <Switch
            label={t('settings.reopen.title')}
            checked={bool('autoOpenReopenAfterClose', true)}
            disabled={disabled}
            onChange={(next) => { write('autoOpenReopenAfterClose', next) }}
          />
        </Row>
        <Row title={t('settings.tools.title')} hint={t('settings.tools.hint')}>
          <div className="dshtp-settings-segments" role="radiogroup" aria-label={t('settings.tools.title')}>
            {TOOL_MODES.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={toolMode === option.id}
                disabled={disabled}
                className="dshtp-settings-segment"
                data-active={toolMode === option.id ? 'true' : 'false'}
                onClick={() => { write('exposeTools', option.id) }}
              >
                {t(option.key)}
              </button>
            ))}
          </div>
        </Row>
        <Row title={t('settings.intercept.title')} hint={t('settings.intercept.hint')}>
          <Switch
            label={t('settings.intercept.title')}
            checked={bool('interceptShellTools', true)}
            disabled={disabled}
            onChange={(next) => { write('interceptShellTools', next) }}
          />
        </Row>
        <Row title={t('settings.terminal.title')} hint={t('settings.terminal.hint')}>
          <span className="dshtp-settings-hint">{t('settings.terminal.value')}</span>
        </Row>
      </div>

      <div className="dshtp-settings-group">
        <div className="dshtp-settings-group-title">{t('settings.group.lifecycle')}</div>
        <Row title={t('settings.history.title')} hint={t('settings.history.hint')}>
          <input
            className="dshtp-settings-number"
            type="number"
            min={0}
            max={512}
            step={1}
            disabled={disabled}
            value={num('historySize', 20)}
            onChange={(event) => { write('historySize', Number(event.currentTarget.value)) }}
          />
        </Row>
        <Row title={t('settings.persist.title')} hint={t('settings.persist.hint')}>
          <Switch
            label={t('settings.persist.title')}
            checked={bool('historyPersist', true)}
            disabled={disabled}
            onChange={(next) => { write('historyPersist', next) }}
          />
        </Row>
        <Row title={t('settings.ports.title')} hint={t('settings.ports.hint')}>
          <Switch
            label={t('settings.ports.title')}
            checked={bool('portDetection', true)}
            disabled={disabled}
            onChange={(next) => { write('portDetection', next) }}
          />
        </Row>
      </div>

      <div className="dshtp-settings-foot">
        {snapshot.status === 'ready' ? t('settings.foot.ready') : t('settings.foot.loading')}
      </div>
    </div>
  )
}
