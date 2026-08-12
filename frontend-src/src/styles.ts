import { css } from "lit";

export const cardStyles = css`
  ha-card {
    overflow: hidden;
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 16px 16px 8px;
  }

  .header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .header-badges {
    display: inline-grid;
    grid-template-columns: auto auto auto auto auto auto;
    column-gap: 3px;
    row-gap: 2px;
    align-items: center;
    justify-items: start;
    justify-content: start;
  }

  .reservoir-estimate {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .refill-button {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--primary-color, #03a9f4);
    cursor: pointer;
  }

  .refill-button:hover {
    filter: brightness(1.15);
  }

  .refill-button ha-icon {
    --mdc-icon-size: 14px;
  }

  .reservoir-label {
    display: inline-flex;
    align-items: center;
    padding: 3px 8px;
    border-radius: 999px;
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--warning-color, #ff9800);
    font-size: 0.7rem;
    font-weight: 600;
  }

  .header-title {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .sensor-badge {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border: none;
    border-radius: 999px;
    background: rgba(3, 169, 244, 0.16);
    color: var(--primary-color, #03a9f4);
    font-size: 0.85rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
  }

  .sensor-badge:hover {
    filter: brightness(1.15);
  }

  .sensor-badge.in-range {
    background: rgba(76, 175, 80, 0.18);
    color: var(--success-color, #4caf50);
  }

  .sensor-badge.out-of-range {
    background: rgba(244, 67, 54, 0.18);
    color: var(--error-color, #f44336);
  }

  .sensor-badge.volume-badge {
    background: var(--secondary-background-color, rgba(255, 255, 255, 0.08));
    color: var(--secondary-text-color);
    cursor: default;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .status {
    font-size: 0.75rem;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 999px;
    white-space: nowrap;
  }

  .status-watering {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .status-scheduled {
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    color: var(--primary-text-color);
  }

  .status-disabled {
    background: var(--error-color, #db4437);
    color: var(--text-primary-color, #fff);
  }

  .next-run {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 2px 16px;
    font-size: 0.85rem;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .last-run:hover {
    color: var(--primary-text-color);
  }

  .last-run-chevron {
    --mdc-icon-size: 18px;
    flex-shrink: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    margin: 8px 16px 0;
  }

  .card-body .section-divider {
    /* .card-body already has its own 16px side padding: no extra inset. */
    margin-left: 0;
    margin-right: 0;
  }

  .history-dialog {
    width: min(90vw, 440px);
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .history-subtitle {
    font-size: 0.8rem;
    font-weight: 400;
    color: var(--secondary-text-color);
    margin-top: 2px;
  }

  .history-stats {
    display: flex;
    gap: 24px;
    padding: 8px 0 12px;
    margin-bottom: 8px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.1));
  }

  .history-stat {
    display: flex;
    flex-direction: column;
  }

  .history-stat-value {
    font-size: 1.1rem;
    font-weight: 600;
  }

  .history-stat-label {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
  }

  .history-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .history-day-header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--secondary-text-color);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.06));
  }

  .history-day-total {
    font-weight: 400;
  }

  .history-entry {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: 0.8rem;
  }

  .history-entry ha-icon {
    --mdc-icon-size: 16px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .history-entry-detail {
    color: var(--secondary-text-color);
    white-space: nowrap;
  }

  .watering-bar {
    padding: 8px 16px;
    background: rgba(3, 169, 244, 0.08);
  }

  .watering-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }

  .watering-left {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .watering-remaining {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: var(--primary-color, #03a9f4);
  }

  .progress-track {
    height: 6px;
    border-radius: 3px;
    background: var(--divider-color, rgba(0, 0, 0, 0.12));
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 3px;
    background: var(--primary-color, #03a9f4);
    transition: width 1s linear;
  }

  .watering-actions {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .schedules {
    margin-top: 8px;
  }

  .schedule-row {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 8px;
    padding: 2px 0;
    border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
  }

  .schedule-row:last-child {
    border-bottom: none;
  }

  .schedule-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .schedule-info-top {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .schedule-row ha-switch {
    /* Material 2 (mwc-switch based) size vars. */
    --mdc-switch-track-height: 12px;
    --mdc-switch-track-width: 20px;
    --mdc-switch-state-layer-size: 16px;
    /* Material 3 (md-switch based) size vars -- newer HA versions render
       ha-switch through this component instead, which ignores the mdc-*
       vars above entirely. */
    --md-switch-track-width: 28px;
    --md-switch-track-height: 16px;
    --md-switch-state-layer-size: 20px;
    --md-switch-selected-handle-width: 12px;
    --md-switch-selected-handle-height: 12px;
    --md-switch-unselected-handle-width: 10px;
    --md-switch-unselected-handle-height: 10px;
    --md-switch-selected-icon-size: 0px;
    --md-switch-unselected-icon-size: 0px;
    flex-shrink: 0;
    /* ha-switch keeps an invisible touch-target inset around the visible
       track regardless of the size vars above. Trim it on the LEFT only (no
       sibling there, it is the row's first column) so the switch doesn't
       waste space; keep the right side clear so it doesn't crowd the info
       column beyond the row's own column gap. */
    margin: 0 6px 0 -10px;
  }

  .schedule-time {
    font-size: 1rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    flex-shrink: 0;
  }

  .schedule-days {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
    letter-spacing: 1px;
  }

  .day-initial {
    font-size: 0.8rem;
    width: 15px;
    text-align: center;
    color: var(--disabled-text-color, rgba(255, 255, 255, 0.3));
  }

  .day-initial.active {
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .warning-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, #ff9800);
    flex-shrink: 0;
  }

  .schedule-duration {
    font-size: 0.9rem;
    color: var(--secondary-text-color);
    min-width: 0;
  }

  .schedule-volume {
    color: var(--primary-color, #03a9f4);
    font-weight: 500;
  }

  .schedule-perpot {
    font-weight: 400;
  }

  .settings-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px 16px 16px;
    border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.08));
    margin-top: 8px;
  }

  .settings-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 4px;
  }

  .settings-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .schedule-actions {
    display: flex;
    align-items: center;
  }

  .schedule-actions ha-icon-button {
    --mdc-icon-button-size: 20px;
    --mdc-icon-size: 13px;
    margin: 0 -6px;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 0.9rem;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 12px;
  }

  .action-circle {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .action-circle:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .action-circle ha-icon {
    --mdc-icon-size: 20px;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 0.9rem;
  }

  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .dialog {
    width: min(90vw, 380px);
    background: var(--card-background-color, var(--primary-background-color, #fff));
    color: var(--primary-text-color);
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .dialog-header {
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: 12px;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
  }

  .field input[type="time"],
  .field input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .day-picker {
    display: grid;
    grid-template-columns: repeat(7, auto);
    gap: 4px;
    justify-content: start;
  }

  .duration-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    padding: 8px 12px;
  }

  .duration-segment {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .duration-segment-label {
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    margin-bottom: 2px;
  }

  .duration-segment-input {
    width: 30px;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
    background: transparent;
    border: none;
    padding: 0;
    color-scheme: dark;
  }

  .duration-segment-input::-webkit-outer-spin-button,
  .duration-segment-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  .duration-segment-input {
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .duration-colon {
    font-size: 1.1rem;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .duration-row {
    display: flex;
    gap: 8px;
  }

  .duration-part {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }

  .duration-part input[type="number"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 1rem;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .duration-part span {
    font-size: 0.8rem;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .day-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 0.7rem;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .day-option input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: var(--primary-color, #03a9f4);
    cursor: pointer;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .dialog-actions button {
    padding: 8px 16px;
    font-size: 0.9rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  .dialog-cancel {
    background: transparent;
    color: var(--primary-text-color);
  }

  .dialog-save {
    background: var(--primary-color, #03a9f4);
    color: var(--text-primary-color, #fff);
  }

  .form-error {
    color: var(--error-color, #db4437);
    font-size: 0.8rem;
  }

  .compact .card-body {
    padding: 0 12px 12px;
  }

  .compact .header {
    padding: 12px 12px 4px;
  }

  .compact .schedule-days,
  .compact .next-run,
  .compact .last-run {
    display: none;
  }
`;
