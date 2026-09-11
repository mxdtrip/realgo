/*
 * Landing-sized port of apps/extension/src/assistant/assistant.styles.ts.
 * Class names, spacing, controls and visual states intentionally mirror the
 * extension. The only shell-level adaptation is height: the panel fills the
 * existing 400x372 landing window instead of changing that window's size.
 */
export const MEMORY_AGENT_DEMO_CSS = `
.realgo-popup .memory-demo-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  opacity: 1;
  transition: none;
}
.realgo-popup .memory-demo-layer--agent { z-index: 2; }
.realgo-popup .memory-demo-layer--rating { z-index: 1; }
.realgo-popup .memory-demo-layer[data-active="false"] { pointer-events: none; }
.realgo-popup .memory-demo-layer[data-active="true"] { pointer-events: auto; }

/* The shell stays put while its real UI regions leave and enter independently.
   No opacity is involved: the fixed popup overflow clips each flying element. */
.realgo-popup--journey .memory-demo-layer .realgo-task,
.realgo-popup--journey .memory-demo-layer .realgo-body,
.realgo-popup--journey .memory-demo-layer .realgo-state {
  animation: none;
}
.realgo-popup--journey .memory-demo-layer--agent .realgo-agent-header {
  transform: translate3d(0, var(--memory-agent-header-y, 0px), 0);
}
.realgo-popup--journey .memory-demo-layer--agent .realgo-agent-task {
  transform: translate3d(var(--memory-agent-task-x, 0px), 0, 0);
}
.realgo-popup--journey .memory-demo-layer--agent .realgo-agent-messages,
.realgo-popup--journey .memory-demo-layer--agent .realgo-agent-demo-collapsed {
  transform: translate3d(var(--memory-agent-messages-x, 0px), 0, 0);
}
.realgo-popup--journey .memory-demo-layer--agent .realgo-agent-actions-wrap {
  transform: translate3d(0, var(--memory-agent-actions-y, 0px), 0);
}
.realgo-popup--journey .memory-demo-layer--rating .realgo-header {
  transform: translate3d(0, var(--memory-rating-header-y, -62px), 0);
}
.realgo-popup--journey .memory-demo-layer--rating .realgo-task {
  transform: translate3d(var(--memory-rating-task-x, 430px), 0, 0);
}
.realgo-popup--journey .memory-demo-layer--rating .realgo-body,
.realgo-popup--journey .memory-demo-layer--rating .realgo-state {
  transform: translate3d(0, var(--memory-rating-body-y, 390px), 0);
}
.realgo-popup--journey .realgo-agent-header,
.realgo-popup--journey .realgo-agent-task,
.realgo-popup--journey .realgo-agent-messages,
.realgo-popup--journey .realgo-agent-actions-wrap,
.realgo-popup--journey .realgo-agent-demo-collapsed,
.realgo-popup--journey .memory-demo-layer--rating .realgo-header,
.realgo-popup--journey .memory-demo-layer--rating .realgo-task,
.realgo-popup--journey .memory-demo-layer--rating .realgo-body,
.realgo-popup--journey .memory-demo-layer--rating .realgo-state {
  will-change: transform;
}

.realgo-popup .realgo-assistant,
.realgo-popup .realgo-assistant * { box-sizing: border-box; }

.realgo-popup .realgo-assistant {
  width: 100%;
  height: 100%;
  background: transparent;
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 13px;
  line-height: 1.45;
  -webkit-font-smoothing: antialiased;
}

.realgo-popup .realgo-agent-panel {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 0;
  border-radius: inherit;
  background: transparent;
  box-shadow: none;
}

.realgo-popup .realgo-agent-header {
  min-height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 13px;
  border-bottom: 1px solid rgba(88, 166, 255, 0.12);
  background: rgba(3, 7, 13, 0.62);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.realgo-popup .realgo-agent-brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  min-width: 0;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
}
.realgo-popup .realgo-agent-path {
  color: var(--text-faint);
  font-weight: 500;
}
.realgo-popup .realgo-agent-logo {
  width: 20px;
  height: 20px;
  flex: 0 0 auto;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.18));
}

.realgo-popup .realgo-agent-status {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-left: auto;
  padding: 4px 8px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent-bright);
  font-family: var(--font-mono);
  font-size: 9.5px;
  line-height: 1.2;
  white-space: nowrap;
}
.realgo-popup .realgo-agent-status__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 0 4px rgba(56, 139, 253, 0.11);
}

.realgo-popup .realgo-agent-iconbtn {
  width: 27px;
  height: 27px;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--text-dim);
  padding: 0;
  cursor: pointer;
}
.realgo-popup .realgo-agent-iconbtn:hover:not(:disabled) {
  border-color: var(--border);
  background: rgba(255, 255, 255, 0.05);
  color: var(--text);
}

.realgo-popup .realgo-agent-task {
  display: grid;
  justify-items: center;
  gap: 6px;
  padding: 9px 13px 10px;
  border-bottom: 1px solid rgba(88, 166, 255, 0.11);
  background: linear-gradient(180deg, rgba(8, 13, 21, 0.62), rgba(4, 8, 14, 0.42));
  text-align: center;
}
.realgo-popup .realgo-agent-title {
  margin: 0;
  color: var(--text);
  font-size: 13.5px;
  font-weight: 700;
  word-break: normal;
  overflow-wrap: normal;
  hyphens: none;
}
.realgo-popup .realgo-agent-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}
.realgo-popup .realgo-agent-tag {
  max-width: 135px;
  padding: 2px 7px;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-dim);
  font-family: var(--font-mono);
  font-size: 9.5px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.realgo-popup .realgo-agent-tag--medium {
  border-color: rgba(210, 153, 34, 0.4);
  background: rgba(210, 153, 34, 0.12);
  color: #d29922;
}
.realgo-popup .realgo-agent-tag--leetcode {
  border-color: rgba(255, 161, 22, 0.4);
  background: rgba(255, 161, 22, 0.12);
  color: #ffa116;
}

.realgo-popup .realgo-agent-messages {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 10px 13px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.018) 1px, transparent 1px),
    transparent;
  background-size: 100% 28px;
  scrollbar-color: var(--border) transparent;
  scrollbar-width: thin;
}

.realgo-popup .realgo-agent-msg {
  max-width: 92%;
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 9px;
  background: rgba(22, 27, 34, 0.72);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.035);
  word-break: normal;
  overflow-wrap: normal;
  hyphens: none;
}
.realgo-popup .realgo-agent-msg--user {
  align-self: flex-end;
  border-color: var(--accent-line);
  background: var(--accent-soft);
}
.realgo-popup .realgo-agent-msg--assistant { align-self: flex-start; }
.realgo-popup .realgo-agent-msg__role {
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 9.5px;
}
.realgo-popup .realgo-agent-msg p {
  margin: 0;
  color: var(--text);
  font-size: 11.5px;
  line-height: 1.42;
  white-space: pre-wrap;
}

.realgo-popup .realgo-agent-loading {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--text-faint);
  font-family: var(--font-mono);
  font-size: 10.5px;
}
.realgo-popup .realgo-agent-spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(125, 133, 144, 0.35);
  border-top-color: var(--accent-bright);
  border-radius: 50%;
  animation: realgo-memory-agent-spin 0.8s linear infinite;
}
@keyframes realgo-memory-agent-spin { to { transform: rotate(360deg); } }

.realgo-popup .realgo-agent-actions-wrap {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 13px 11px;
  border-top: 1px solid rgba(88, 166, 255, 0.08);
}
.realgo-popup .realgo-agent-actions {
  display: flex;
  gap: 8px;
}
.realgo-popup .realgo-agent-btn {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text);
  padding: 6px 10px;
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 600;
  cursor: pointer;
}
.realgo-popup .realgo-agent-btn:hover:not(:disabled) {
  border-color: var(--accent-line);
  color: var(--accent-bright);
}
.realgo-popup .realgo-agent-btn:disabled,
.realgo-popup .realgo-agent-iconbtn:disabled,
.realgo-popup .realgo-agent-button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}
.realgo-popup .realgo-agent-btn--hint {
  position: relative;
  flex: 1;
  overflow: hidden;
}
.realgo-popup .realgo-agent-btn__label { position: relative; z-index: 1; }
.realgo-popup .realgo-agent-hints-done {
  margin: 0;
  padding: 6px 9px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.03);
  color: var(--text-dim);
  font-size: 10px;
  text-align: center;
}

.realgo-popup .realgo-agent-demo-collapsed {
  display: grid;
  place-items: center;
}
.realgo-popup .realgo-agent-button {
  min-width: 150px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  border: 1px solid var(--accent-line);
  border-radius: 999px;
  padding: 10px 14px;
  background:
    radial-gradient(180px 80px at 85% -10%, rgba(88, 166, 255, 0.24), transparent 70%),
    var(--bg);
  color: var(--text);
  box-shadow: 0 18px 44px -24px rgba(1, 4, 9, 0.95);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}
.realgo-popup .realgo-agent-button:hover:not(:disabled) {
  border-color: var(--accent-bright);
  color: var(--accent-bright);
}

@media (prefers-reduced-motion: reduce) {
  .realgo-popup .realgo-agent-spinner { animation: none; }
}
`;
