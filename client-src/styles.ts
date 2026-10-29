// Panel stylesheet (Claude skin).

export const styles = String.raw`

.dshtp-root {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  min-width: 0;
  box-sizing: border-box;
  container-type: inline-size;
  container-name: dshtp;
  font-size: 13px;
  line-height: 1.4;
  color: var(--dsw-alias-label-primary, inherit);
  background: transparent;
}

.dshtp-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshtp-root a {
  color: var(--dsw-alias-link, var(--dsw-alias-label-primary, inherit));
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dshtp-root [hidden] {
  display: none !important;
}

.dshtp-chrome {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  box-sizing: border-box;
  height: 32px;
  min-height: 32px;
  padding: 0 8px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}

.dshtp-new,
.dshtp-expand,
.dshtp-more,
.dshtp-follow,
.dshtp-tab-keep,
.dshtp-tab-close,
.dshtp-dialog-close,
.dshtp-search-close,
.dshtp-search-action,
.dshtp-banner-close,
.dshtp-toast-close,
.dshtp-global-toast-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-sizing: border-box;
  width: 24px;
  height: 24px;
  min-width: 24px;
  padding: 0;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--ds-transition-duration-fast, 0.1s) ease,
    color var(--ds-transition-duration-fast, 0.1s) ease;
}

.dshtp-new:hover:not(:disabled),
.dshtp-expand:hover:not(:disabled),
.dshtp-more:hover:not(:disabled),
.dshtp-follow:hover:not(:disabled),
.dshtp-tab-keep:hover:not(:disabled),
.dshtp-tab-close:hover:not(:disabled),
.dshtp-dialog-close:hover:not(:disabled),
.dshtp-search-close:hover:not(:disabled),
.dshtp-search-action:hover:not(:disabled),
.dshtp-banner-close:hover:not(:disabled),
.dshtp-toast-close:hover:not(:disabled),
.dshtp-global-toast-close:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-new:disabled,
.dshtp-expand:disabled,
.dshtp-more:disabled,
.dshtp-follow:disabled,
.dshtp-tab-keep:disabled,
.dshtp-tab-close:disabled,
.dshtp-search-action:disabled,
.dshtp-banner-close:disabled,
.dshtp-toast-close:disabled {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}

.dshtp-new svg,
.dshtp-expand svg,
.dshtp-more svg,
.dshtp-follow svg {
  width: 14px;
  height: 14px;
}

.dshtp-new {
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary, #4d6bfe));
  color: var(--dsw-alias-label-primary-foreground, inherit);
}

.dshtp-new:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary, #4d6bfe));
  color: var(--dsw-alias-label-primary-foreground, inherit);
}

.dshtp-more {
  font-size: 14px;
  letter-spacing: 0.5px;
}

.dshtp-follow[data-follow='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.14));
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-session-strip {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1 1 auto;
  min-width: 0;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  scroll-behavior: smooth;
  scroll-padding-inline: 4px;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3)) transparent;
  mask-image: linear-gradient(to right, transparent 0, #000 6px, #000 calc(100% - 6px), transparent 100%);
  -webkit-mask-image: linear-gradient(to right, transparent 0, #000 6px, #000 calc(100% - 6px), transparent 100%);
}

.dshtp-session-strip::-webkit-scrollbar {
  height: 8px;
}

.dshtp-session-strip::-webkit-scrollbar-track {
  background: transparent;
}

.dshtp-session-strip::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3));
  border-radius: 999px;
}

.dshtp-session-strip:hover::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-hover-l2, var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.4)));
}

.dshtp-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  box-sizing: border-box;
  height: 24px;
  max-width: 220px;
  min-width: 0;
  margin: 0;
  padding: 0 4px 0 8px;
  border: 0.5px solid transparent;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  user-select: none;
  transition:
    background-color var(--ds-transition-duration-fast, 0.1s) ease,
    border-color var(--ds-transition-duration-fast, 0.1s) ease,
    color var(--ds-transition-duration-fast, 0.1s) ease;
}

.dshtp-tab:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.dshtp-tab[data-active='true'],
.dshtp-tab[data-active]:not([data-active='false']) {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.14));
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.24));
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab::before {
  content: '';
  position: absolute;
  inset-inline-start: 0;
  top: 4px;
  bottom: 4px;
  width: 2px;
  border-radius: 2px;
  background: transparent;
}

.dshtp-tab[data-active='true']::before,
.dshtp-tab[data-active]:not([data-active='false'])::before {
  background: var(--dsw-alias-state-business-primary, var(--dsw-alias-label-primary, currentColor));
}

.dshtp-tab-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  line-height: 1.2;
}

.dshtp-tab[data-active='true'] .dshtp-tab-title,
.dshtp-tab[data-active]:not([data-active='false']) .dshtp-tab-title {
  font-weight: 500;
}

.dshtp-dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
}

.dshtp-tab[data-state='running'] .dshtp-dot,
.dshtp-dot[data-state='running'] {
  background: var(--dsw-alias-state-success-primary, #2fbf71);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-success-primary, #2fbf71) 25%, transparent);
}

.dshtp-tab[data-state='starting'] .dshtp-dot,
.dshtp-dot[data-state='starting'] {
  background: var(--dsw-alias-state-warn-primary, #d98700);
  animation: dshtp-pulse 1.4s ease-in-out infinite;
}

.dshtp-tab[data-state='exited'] .dshtp-dot,
.dshtp-dot[data-state='exited'] {
  background: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
}

.dshtp-tab[data-state='failed'] .dshtp-dot,
.dshtp-dot[data-state='failed'] {
  background: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-tab-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  box-sizing: border-box;
  height: 18px;
  max-width: 76px;
  padding: 0 4px;
  overflow: hidden;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 8%, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.dshtp-tab-badge[data-kind='countdown'],
.dshtp-tab-badge[data-kind='unread'] {
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab-badge[data-kind='running'] {
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #22c55e) 14%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab-badge[data-kind='error'] {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 14%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab-badge[data-kind='sandbox'] {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d98700) 16%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab-keep {
  visibility: hidden;
  pointer-events: none;
}

.dshtp-tab:hover .dshtp-tab-keep,
.dshtp-tab[data-active='true'] .dshtp-tab-keep,
.dshtp-tab[data-active]:not([data-active='false']) .dshtp-tab-keep,
.dshtp-tab[data-pinned='true'] .dshtp-tab-keep,
.dshtp-tab:focus-within .dshtp-tab-keep {
  visibility: visible;
  pointer-events: auto;
}

.dshtp-tab[data-pinned='true'] .dshtp-tab-keep {
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-tab[data-pinned='true'] .dshtp-tab-keep svg {
  fill: currentColor;
}

.dshtp-tab-keep svg,
.dshtp-tab-close svg {
  width: 12px;
  height: 12px;
}

.dshtp-tab-close:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover-danger, rgba(220, 60, 60, 0.14));
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-body {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}

.dshtp-screen {
  position: relative;
  display: flex;
  flex: 1;
  box-sizing: border-box;
  min-width: 0;
  min-height: 0;
  padding: 8px;
  background: var(--dsw-alias-bg-base, transparent);
  overflow: hidden;
}

.dshtp-screen .xterm {
  width: 100%;
  height: 100%;
}

.dshtp-screen .xterm-viewport {
  background: transparent !important;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3)) transparent;
}

.dshtp-screen .xterm-viewport::-webkit-scrollbar {
  width: 8px;
}

.dshtp-screen .xterm-viewport::-webkit-scrollbar-track {
  background: transparent;
}

.dshtp-screen .xterm-viewport::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3));
  border-radius: 999px;
}

.dshtp-screen .xterm-viewport:hover::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-hover-l2, var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.4)));
}

.dshtp-screen:focus-within {
  outline: var(--dsw-focus-ring-width, 2px) solid
    var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: -2px;
  border-radius: var(--dsw-radius-sm, 8px);
}

.dshtp-connecting {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 16px;
  background: var(--dsw-alias-bg-base, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.5;
  text-align: center;
  pointer-events: none;
}

.dshtp-connecting-spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-label-primary, #000) 18%, transparent);
  border-top-color: var(--dsw-alias-label-secondary, inherit);
  animation: dshtp-spin 0.8s linear infinite;
}

.dshtp-connecting-text {
  max-width: 32ch;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.5;
}

.dshtp-skeleton {
  position: relative;
  width: 100%;
  height: 12px;
  overflow: hidden;
  border-radius: 6px;
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
}

.dshtp-skeleton + .dshtp-skeleton {
  margin-top: 8px;
}

.dshtp-skeleton[data-size='title'] {
  width: 38%;
  height: 16px;
}

.dshtp-skeleton[data-size='block'] {
  height: 72px;
}

.dshtp-skeleton::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--dsw-alias-label-primary, #000) 8%, transparent),
    transparent
  );
  transform: translateX(-100%);
  animation: dshtp-shimmer 1.4s ease-in-out infinite;
}

.dshtp-skeleton[data-size='block'] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: auto;
  min-height: 72px;
  padding: 8px;
  overflow: visible;
  background: transparent;
}

.dshtp-skeleton[data-size='block']::after {
  display: none;
}

.dshtp-skeleton[data-size='line'] {
  height: 12px;
}

.dshtp-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  flex: none;
  box-sizing: border-box;
  margin: 8px 8px 0;
  padding: 6px 8px;
  border-inline-start: 2px solid transparent;
  border-radius: var(--dsw-radius-sm, 8px);
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 6%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12px;
  line-height: 1.5;
}

.dshtp-banner:last-child {
  margin-bottom: 8px;
}

.dshtp-banner[data-kind='error'] {
  border-inline-start-color: var(--dsw-alias-state-error-primary, #e5484d);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 10%, transparent);
}

.dshtp-banner[data-kind='warn'] {
  border-inline-start-color: var(--dsw-alias-state-warn-primary, #d98700);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d98700) 12%, transparent);
}

.dshtp-banner[data-kind='readonly'] {
  border-inline-start-color: var(--dsw-alias-state-business-primary, #4d6bfe);
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 10%, transparent);
}

.dshtp-banner-text {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.dshtp-banner-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.dshtp-toast {
  position: absolute;
  inset-inline: 8px;
  inset-block-end: 8px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: min(560px, 100%);
  margin-inline: auto;
  padding: 6px 6px 6px 10px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-toast-bg, rgba(30, 32, 38, 0.94));
  color: var(--dsw-alias-toast-label, #f4f4f5);
  font-size: 12px;
  line-height: 1.5;
  box-shadow: var(--dsw-elevation-soft, 0 2px 8px rgba(0, 0, 0, 0.25));
}

.dshtp-toast-text {
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.dshtp-toast-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: none;
}

.dshtp-toast-close {
  color: inherit;
}

.dshtp-toast .dshtp-action {
  color: inherit;
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 12%, transparent);
  box-shadow: none;
}

.dshtp-toast .dshtp-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 22%, transparent);
}

.dshtp-toast .dshtp-action[data-variant='primary'] {
  background: var(--dsw-alias-toast-label, #f4f4f5);
  color: var(--dsw-alias-toast-bg, #1e2026);
}

.dshtp-toast-close:hover:not(:disabled) {
  color: var(--dsw-alias-toast-label, #f4f4f5);
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 16%, transparent);
}

.dshtp-statusbar {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  z-index: 4;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  box-sizing: border-box;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, transparent));
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
}

.dshtp-root:has(.dshtp-statusbar[data-visible='true']) .dshtp-toast {
  inset-block-end: 32px;
}

.dshtp-statusbar[data-visible='false'] {
  display: none;
}

.dshtp-statusbar .dshtp-dot {
  width: 8px;
  height: 8px;
}

.dshtp-status-item {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-variant-numeric: tabular-nums;
}

.dshtp-status-spacer {
  flex: 1;
  min-width: 8px;
}

.dshtp-statusbar .dshtp-sandbox-badge,
.dshtp-statusbar .dshtp-readonly-badge {
  height: 18px;
}

.dshtp-menu,
.dshtp-context-menu {
  position: absolute;
  z-index: 30;
  box-sizing: border-box;
  min-width: 184px;
  max-width: min(280px, calc(100% - 16px));
  max-height: min(60vh, 360px);
  padding: 4px;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3)) transparent;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, transparent));
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12px;
  line-height: 1.4;
  box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.18));
}

.dshtp-menu {
  inset-block-start: 36px;
  inset-inline-end: 8px;
}

.dshtp-context-menu {
  position: fixed;
  z-index: 1150;
  inset-block-start: 0;
  inset-inline-start: 0;
}

.dshtp-menu[hidden],
.dshtp-context-menu[hidden] {
  display: none;
}

.dshtp-menu-item,
.dshtp-context-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  min-height: 28px;
  margin: 0;
  padding: 4px 8px;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
  text-align: start;
  white-space: nowrap;
  cursor: pointer;
}

.dshtp-menu-item:hover:not(:disabled),
.dshtp-context-menu-item:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.dshtp-menu-item[data-danger='true'],
.dshtp-context-menu-item[data-danger='true'] {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-menu-item:disabled,
.dshtp-context-menu-item:disabled {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}

.dshtp-menu-item svg,
.dshtp-context-menu-item svg {
  flex: none;
  width: 14px;
  height: 14px;
  color: var(--dsw-alias-label-secondary, inherit);
}

.dshtp-menu-item[data-danger='true'] svg {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-menu-sep {
  height: 1px;
  margin: 4px 2px;
  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}

.dshtp-root kbd,
.dshtp-global-toast kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  box-sizing: border-box;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 8%, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1;
}

.dshtp-menu-item kbd,
.dshtp-context-menu-item kbd,
.dshtp-dialog kbd {
  margin-inline-start: auto;
}

.dshtp-action,
.dshtp-dialog-action,
.dshtp-banner-action,
.dshtp-status-action,
.dshtp-toast-action,
.dshtp-empty-action,
.dshtp-error-action,
.dshtp-global-toast-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  flex: none;
  box-sizing: border-box;
  min-height: 24px;
  margin: 0;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}

.dshtp-action:hover:not(:disabled),
.dshtp-dialog-action:hover,
.dshtp-banner-action:hover,
.dshtp-status-action:hover,
.dshtp-toast-action:hover,
.dshtp-empty-action:hover,
.dshtp-error-action:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.dshtp-action:disabled,
.dshtp-dialog-action:disabled,
.dshtp-banner-action:disabled,
.dshtp-status-action:disabled,
.dshtp-toast-action:disabled,
.dshtp-empty-action:disabled,
.dshtp-error-action:disabled {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}

.dshtp-action[data-variant='ghost'],
.dshtp-dialog-action[data-variant='ghost'],
.dshtp-banner-action[data-variant='ghost'],
.dshtp-status-action[data-variant='ghost'] {
  box-shadow: none;
  background: transparent;
}

.dshtp-action[data-variant='ghost']:hover:not(:disabled),
.dshtp-dialog-action[data-variant='ghost']:hover:not(:disabled),
.dshtp-banner-action[data-variant='ghost']:hover:not(:disabled),
.dshtp-status-action[data-variant='ghost']:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.dshtp-action[data-variant='primary'],
.dshtp-dialog-action[data-variant='primary'],
.dshtp-empty-action[data-variant='primary'],
.dshtp-error-action[data-variant='primary'] {
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary, #4d6bfe));
  color: var(--dsw-alias-label-primary-foreground, inherit);
  box-shadow: none;
}

.dshtp-action[data-variant='primary']:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-brand-primary, #4d6bfe));
}

.dshtp-action[data-variant='danger'],
.dshtp-dialog-action[data-variant='danger'],
.dshtp-error-action[data-variant='danger'] {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-global-toast-action {
  min-height: 24px;
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 14%, transparent);
  color: inherit;
  box-shadow: none;
}

.dshtp-global-toast-action:hover {
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 24%, transparent);
}

.dshtp-dialog {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 12px;
  background: var(--dsw-alias-bg-mask-1, rgba(0, 0, 0, 0.24));
}

.dshtp-dialog-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 520px;
  max-height: calc(100% - 8px);
  box-sizing: border-box;
  overflow: hidden;
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, transparent));
  color: var(--dsw-alias-label-primary, inherit);
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.24));
}

.dshtp-dialog-header {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  padding: 8px 8px 8px 12px;
}

.dshtp-dialog-title {
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshtp-dialog-body {
  flex: 1;
  min-height: 0;
  padding: 0 12px 12px;
  overflow: auto;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.6;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3)) transparent;
}

.dshtp-dialog-body::-webkit-scrollbar {
  width: 8px;
}

.dshtp-dialog-body::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3));
  border-radius: 999px;
}

.dshtp-dialog-hint {
  margin: 0 0 8px;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.6;
}

.dshtp-dialog-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.dshtp-dialog-field label {
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.4;
}

.dshtp-dialog-input,
.dshtp-dialog-select {
  box-sizing: border-box;
  width: 100%;
  height: 28px;
  padding: 0 8px;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: var(--dsw-alias-bg-layer-1, transparent);
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1;
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
}

.dshtp-dialog-input::placeholder {
  color: var(--dsw-alias-label-secondary, inherit);
}

.dshtp-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex: none;
  flex-wrap: wrap;
  padding: 8px 12px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 4%, transparent);
}

.dshtp-dialog-footer .dshtp-dialog-hint {
  flex: 1;
  min-width: 0;
  margin: 0;
}

.dshtp-dialog-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}

.dshtp-search-bar {
  position: absolute;
  inset-inline: 8px;
  inset-block-start: 8px;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 2px;
  box-sizing: border-box;
  height: 32px;
  padding: 4px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base, transparent));
  box-shadow: var(--dsw-elevation-panel, 0 8px 24px rgba(0, 0, 0, 0.18));
}

.dshtp-search-bar[hidden] {
  display: none;
}

.dshtp-search-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  border: 0;
  border-radius: var(--dsw-radius-xs, 4px);
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font: inherit;
  font-size: 12px;
  line-height: 1;
}

.dshtp-search-input::placeholder {
  color: var(--dsw-alias-label-secondary, inherit);
}

.dshtp-search-count {
  flex: none;
  min-width: 52px;
  padding: 0 4px;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.dshtp-search-count[data-empty='true'] {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-history-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  overflow: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--dsw-alias-scrollbar-bg-l2, rgba(127, 127, 127, 0.3)) transparent;
}

.dshtp-history-view {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
  padding: 8px 8px 0;
}

.dshtp-history-view > .dshtp-banner {
  margin: 0;
}

.dshtp-history-view > .dshtp-history-preview {
  flex: 1;
  min-height: 0;
  max-height: none;
  margin: 0;
  padding: 8px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-layer-1, transparent);
}

.dshtp-body > .dshtp-history-list {
  flex: 1;
  padding: 8px;
}

.dshtp-history-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  box-sizing: border-box;
  margin: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--dsw-radius-sm, 8px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}

.dshtp-history-item:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.dshtp-history-item[data-active='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.14));
}

.dshtp-history-title {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 12px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshtp-history-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.dshtp-history-cwd {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dshtp-history-preview {
  margin: 4px 0 0;
  max-height: 84px;
  overflow: auto;
  color: var(--dsw-alias-label-secondary, inherit);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 1.4;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.dshtp-history-badge {
  display: inline-flex;
  align-items: center;
  flex: none;
  box-sizing: border-box;
  height: 18px;
  padding: 0 4px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 8%, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.dshtp-history-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex: none;
  flex-wrap: wrap;
}

.dshtp-history-count {
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
}

.dshtp-history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  min-height: 120px;
  padding: 16px;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.dshtp-sandbox-badge,
.dshtp-readonly-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  box-sizing: border-box;
  height: 18px;
  padding: 0 6px;
  border-radius: var(--dsw-radius-xs, 4px);
  background: color-mix(in srgb, var(--dsw-alias-label-primary, #000) 8%, transparent);
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
}

.dshtp-readonly-badge {
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary, #4d6bfe) 12%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-sandbox-badge[data-required='true'],
.dshtp-sandbox-badge[data-mode='read-only'],
.dshtp-sandbox-badge[data-mode='workspace-write'] {
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #d98700) 16%, transparent);
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-sandbox-badge svg,
.dshtp-readonly-badge svg {
  width: 12px;
  height: 12px;
}

.dshtp-empty,
.dshtp-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding: 24px 16px;
  overflow: auto;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.6;
  text-align: center;
}

.dshtp-empty-icon,
.dshtp-error-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  color: var(--dsw-alias-label-secondary, inherit);
}

.dshtp-error-icon {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-empty-title,
.dshtp-error-title {
  margin: 0;
  max-width: 30ch;
  color: var(--dsw-alias-label-primary, inherit);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.dshtp-error-title {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}

.dshtp-empty-hint,
.dshtp-error-detail {
  margin: 0;
  max-width: 42ch;
  color: var(--dsw-alias-label-secondary, inherit);
  font-size: 12px;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.dshtp-empty-actions,
.dshtp-error-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}

.dshtp-global-toast-stack {
  position: fixed;
  inset-block-end: 24px;
  inset-inline-end: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  max-width: min(380px, calc(100vw - 32px));
  pointer-events: none;
}

.dshtp-global-toast-stack .dshtp-global-toast {
  position: relative;
  inset: auto;
  z-index: auto;
  width: 100%;
  pointer-events: auto;
}

.dshtp-global-toast {
  position: fixed;
  inset-block-end: 24px;
  inset-inline-end: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-sizing: border-box;
  width: min(380px, calc(100vw - 32px));
  padding: 10px 32px 10px 12px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-toast-bg, rgba(30, 32, 38, 0.94));
  color: var(--dsw-alias-toast-label, #f4f4f5);
  font-size: 12px;
  line-height: 1.5;
  box-shadow: var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.28));
}

.dshtp-global-toast[data-kind='error'] {
  box-shadow:
    var(--dsw-elevation-prominent, 0 12px 32px rgba(0, 0, 0, 0.28)),
    inset 2px 0 0 var(--dsw-alias-state-error-secondary, #e5484d);
}

.dshtp-global-toast-title {
  color: inherit;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.dshtp-global-toast-body {
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  opacity: 0.92;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
}

.dshtp-global-toast-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
  margin-top: 2px;
}

.dshtp-global-toast-close {
  position: absolute;
  inset-block-start: 6px;
  inset-inline-end: 6px;
  color: inherit;
}

.dshtp-global-toast-close:hover:not(:disabled) {
  color: var(--dsw-alias-toast-label, #f4f4f5);
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 16%, transparent);
}

.dshtp-global-toast .dshtp-action {
  color: inherit;
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 14%, transparent);
  box-shadow: none;
}

.dshtp-global-toast .dshtp-action:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-toast-label, #f4f4f5) 24%, transparent);
}

.dshtp-global-toast .dshtp-action[data-variant='primary'] {
  background: var(--dsw-alias-toast-label, #f4f4f5);
  color: var(--dsw-alias-toast-bg, #1e2026);
}

.dshtp-root :is(
  .dshtp-new,
  .dshtp-more,
  .dshtp-follow,
  .dshtp-tab,
  .dshtp-tab-keep,
  .dshtp-tab-close,
  .dshtp-menu-item,
  .dshtp-context-menu-item,
  .dshtp-dialog-close,
  .dshtp-dialog-input,
  .dshtp-dialog-select,
  .dshtp-search-input,
  .dshtp-search-action,
  .dshtp-search-close,
  .dshtp-history-item,
  .dshtp-action,
  .dshtp-dialog-action,
  .dshtp-banner-action,
  .dshtp-status-action,
  .dshtp-toast-action,
  .dshtp-empty-action,
  .dshtp-error-action
):focus-visible,
.dshtp-global-toast button:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid
    var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary, #4d6bfe));
  outline-offset: 2px;
}

.dshtp-tab-keep:focus-visible,
.dshtp-tab-close:focus-visible,
.dshtp-statusbar .dshtp-action:focus-visible,
.dshtp-menu-item:focus-visible,
.dshtp-context-menu-item:focus-visible,
.dshtp-toast .dshtp-action:focus-visible {
  outline-offset: -2px;
}

@container dshtp (max-width: 340px) {
  .dshtp-label {
    display: none !important;
  }

  .dshtp-chrome {
    gap: 2px;
    padding-inline: 4px;
  }

  .dshtp-tab {
    max-width: 160px;
    padding-inline: 6px 2px;
  }

  .dshtp-tab-keep {
    display: none;
  }

  .dshtp-tab[data-pinned='true'] .dshtp-tab-keep {
    display: inline-flex;
  }

  .dshtp-session-strip {
    mask-image: none;
    -webkit-mask-image: none;
  }

  .dshtp-status-spacer + .dshtp-status-optional,
  .dshtp-statusbar .dshtp-status-optional {
    display: none;
  }

  .dshtp-search-count {
    min-width: 40px;
  }

  .dshtp-history-preview {
    max-height: 56px;
  }

  .dshtp-dialog {
    padding: 8px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dshtp-root *,
  .dshtp-global-toast * {
    transition: none !important;
    animation: none !important;
    scroll-behavior: auto !important;
  }
}

@keyframes dshtp-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes dshtp-shimmer {
  to {
    transform: translateX(100%);
  }
}

@keyframes dshtp-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}

.dshtp-focus-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1290;
  background: rgba(8, 10, 14, 0.42);
  backdrop-filter: blur(2px);
  animation: dshtp-fade-in 0.12s ease;
}

.dshtp-root[data-expanded='true'] {
  position: fixed;
  inset: 3vh 3.5vw;
  z-index: 1300;
  width: auto;
  height: auto;
  max-width: none;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.2));
  border-radius: 14px;
  background: var(--dsw-alias-bg-base, #fff);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.28);
  overflow: hidden;
}

.dshtp-root[data-expanded='true'] .dshtp-chrome {
  height: 38px;
  min-height: 38px;
  padding: 0 12px;
}

.dshtp-root[data-expanded='true'] .dshtp-screen {
  padding: 12px 16px;
}

.dshtp-root[data-expanded='true'] .dshtp-statusbar {
  padding-left: 16px;
  padding-right: 16px;
}

.dshtp-expand[aria-pressed='true'] {
  background: var(--dsw-alias-interactive-bg-active, rgba(127, 127, 127, 0.14));
  color: var(--dsw-alias-label-primary, inherit);
}

.dshtp-menu-value {
  margin-left: auto;
  color: var(--dsw-alias-label-tertiary, rgba(127, 127, 127, 0.9));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

@keyframes dshtp-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@media (max-width: 720px) {
  .dshtp-root[data-expanded='true'] {
    inset: 8px;
    border-radius: 10px;
  }
}

.dshtp-root {
  --dshtp-ui-font: var(--dsh-claude-font-ui, "Claude Style Inter", Inter, "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif);
  --dshtp-serif: var(--dsh-claude-font-serif, "Claude Style Noto Serif", Georgia, "Noto Serif SC", serif);
  --dshtp-mono: var(--dsh-claude-font-code, "JetBrains Mono", "Cascadia Mono", ui-monospace, Consolas, monospace);
  --dshtp-ink: var(--dsw-alias-label-primary, #191919);
  --dshtp-ink-2: var(--dsw-alias-label-secondary, #6b6a63);
  --dshtp-ink-3: var(--dsw-alias-label-tertiary, #8f8d85);
  --dshtp-hairline: var(--dsh-claude-divider, rgba(22, 22, 22, 0.08));
  --dshtp-wash: var(--dsh-claude-hover-bg, rgba(6, 6, 6, 0.06));
  --dshtp-accent: var(--dsw-alias-brand-primary, #d97757);
  --dshtp-accent-ink: var(--dsw-alias-brand-text, #ffffff);
  --dshtp-radius-control: 6px;
  --dshtp-radius-item: 8px;
  --dshtp-radius-card: 12px;
  --dshtp-shadow-card: 0 12px 32px -18px rgba(22, 22, 22, 0.35), 0 1px 2px rgba(22, 22, 22, 0.06);
  font-family: var(--dshtp-ui-font);
  color: var(--dshtp-ink);
  letter-spacing: 0.002em;
  -webkit-font-smoothing: antialiased;
}

.dshtp-chrome {
  height: 34px;
  min-height: 34px;
  padding: 0 6px 0 8px;
  border-bottom: 1px solid var(--dshtp-hairline);
}

.dshtp-new,
.dshtp-expand,
.dshtp-more,
.dshtp-follow,
.dshtp-tab-keep,
.dshtp-tab-close,
.dshtp-dialog-close,
.dshtp-search-close,
.dshtp-search-action,
.dshtp-banner-close,
.dshtp-toast-close,
.dshtp-global-toast-close {
  width: 26px;
  height: 26px;
  min-width: 26px;
  border-radius: var(--dshtp-radius-control);
  color: var(--dshtp-ink-2);
}

.dshtp-new:hover:not(:disabled),
.dshtp-expand:hover:not(:disabled),
.dshtp-more:hover:not(:disabled),
.dshtp-follow:hover:not(:disabled),
.dshtp-dialog-close:hover:not(:disabled),
.dshtp-search-close:hover:not(:disabled),
.dshtp-search-action:hover:not(:disabled),
.dshtp-banner-close:hover:not(:disabled),
.dshtp-toast-close:hover:not(:disabled),
.dshtp-global-toast-close:hover:not(:disabled) {
  background: var(--dshtp-wash);
  color: var(--dshtp-ink);
}

.dshtp-follow[data-follow='true'] {
  color: var(--dshtp-accent);
}

.dshtp-session-strip {
  gap: 2px;
}

.dshtp-tab {
  height: 26px;
  padding: 0 6px 0 8px;
  border-radius: var(--dshtp-radius-control);
  color: var(--dshtp-ink-2);
  font-family: var(--dshtp-ui-font);
  font-size: 12px;
  letter-spacing: 0.004em;
}

.dshtp-tab:hover {
  background: var(--dshtp-wash);
  color: var(--dshtp-ink);
}

.dshtp-tab[data-active='true'],
.dshtp-tab[data-active]:not([data-active='false']) {
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.12));
  border-color: var(--dshtp-hairline);
  color: var(--dshtp-ink);
}

.dshtp-tab::before {
  top: 6px;
  bottom: 6px;
  width: 2px;
  border-radius: 2px;
}

.dshtp-tab[data-active='true']::before,
.dshtp-tab[data-active]:not([data-active='false'])::before {
  background: var(--dshtp-accent);
}

.dshtp-tab-title {
  font-weight: 450;
}

.dshtp-tab[data-active='true'] .dshtp-tab-title,
.dshtp-tab[data-active]:not([data-active='false']) .dshtp-tab-title {
  font-weight: 560;
}

.dshtp-tab-badge {
  height: 17px;
  padding: 0 6px;
  border-radius: 999px;
  font-family: var(--dshtp-mono);
  font-size: 10.5px;
  letter-spacing: 0.02em;
}

.dshtp-screen {
  padding: 10px 10px 8px;
}

.dshtp-connecting,
.dshtp-skeleton {
  font-family: var(--dshtp-ui-font);
}

.dshtp-banner {
  margin: 6px 8px 0;
  border: 1px solid var(--dshtp-hairline);
  border-radius: var(--dshtp-radius-item);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
  font-family: var(--dshtp-ui-font);
}

.dshtp-banner[data-kind='error'] {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 7%, transparent);
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #e5484d) 22%, transparent);
}

.dshtp-inline-toast,
.dshtp-toast {
  border-radius: var(--dshtp-radius-card);
  border: 1px solid var(--dshtp-hairline);
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-2, rgba(30, 30, 30, 0.96)));
  box-shadow: var(--dshtp-shadow-card);
  font-family: var(--dshtp-ui-font);
}

.dshtp-statusbar {
  border-top: 1px solid var(--dshtp-hairline);
  font-family: var(--dshtp-mono);
  font-size: 10.5px;
  letter-spacing: 0.015em;
  color: var(--dshtp-ink-3);
}

.dshtp-status-action,
.dshtp-status-item {
  font-family: var(--dshtp-mono);
}

.dshtp-menu,
.dshtp-context-menu {
  border: 1px solid var(--dshtp-hairline);
  border-radius: 10px;
  background: var(--dsw-alias-bg-overlay, var(--dsw-alias-bg-layer-2, rgba(30, 30, 30, 0.98)));
  box-shadow: var(--dshtp-shadow-card);
  font-family: var(--dshtp-ui-font);
}

.dshtp-menu-item,
.dshtp-context-menu-item {
  border-radius: var(--dshtp-radius-control);
  font-size: 12.5px;
}

.dshtp-dialog-card {
  border: 1px solid var(--dshtp-hairline);
  border-radius: 14px;
  box-shadow: var(--dshtp-shadow-card);
  font-family: var(--dshtp-ui-font);
}

.dshtp-dialog-title {
  font-family: var(--dshtp-serif);
  font-weight: 500;
  letter-spacing: 0.005em;
}

.dshtp-dialog-select,
.dshtp-search-input,
.dshtp-dialog-field input {
  border-radius: var(--dshtp-radius-control);
  font-family: var(--dshtp-ui-font);
}

.dshtp-search-bar {
  border: 1px solid var(--dshtp-hairline);
  border-radius: var(--dshtp-radius-item);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.06));
}

.dshtp-history-item {
  border-radius: var(--dshtp-radius-item);
}

.dshtp-history-item[data-active='true'] {
  background: var(--dshtp-wash);
}

.dshtp-history-title {
  font-family: var(--dshtp-ui-font);
  font-weight: 500;
}

.dshtp-history-meta,
.dshtp-history-cwd {
  font-family: var(--dshtp-mono);
  font-size: 10.5px;
}

.dshtp-global-toast {
  border: 1px solid var(--dshtp-hairline);
  border-radius: var(--dshtp-radius-card);
  background: var(--dsw-alias-toast-bg, var(--dsw-alias-bg-overlay, rgba(30, 30, 30, 0.98)));
  box-shadow: var(--dshtp-shadow-card);
  font-family: var(--dshtp-ui-font);
}

.dshtp-global-toast-title {
  font-family: var(--dshtp-ui-font);
  font-weight: 560;
}

.dshtp-action,
.dshtp-dialog-action,
.dshtp-banner-action,
.dshtp-status-action,
.dshtp-empty-action,
.dshtp-error-action,
.dshtp-global-toast-action {
  border-radius: var(--dshtp-radius-control);
  font-family: var(--dshtp-ui-font);
  font-size: 12.5px;
  font-weight: 500;
}

.dshtp-action[data-variant='primary'],
.dshtp-dialog-action[data-variant='primary'],
.dshtp-empty-action[data-variant='primary'],
.dshtp-error-action[data-variant='primary'] {
  background: var(--dshtp-accent);
  color: var(--dshtp-accent-ink);
}

.dshtp-root[data-expanded='true'] {
  border-radius: 14px;
  box-shadow: var(--dshtp-shadow-card);
}

@media (max-width: 720px) {
  .dshtp-root[data-expanded='true'] {
    border-radius: 12px;
  }
}
`
