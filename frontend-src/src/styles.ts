import { css } from "lit";

export const cardStyles = css`
  /* Mirrors the sibling light_scheduler card's token block so both cards
     share one visual language. The green is that card's own value rather
     than the theme's --success-color, which varies per theme and would
     drift the two apart. */
  :host {
    display: block;
    --w-blue: var(--primary-color, #03a9f4);
    --w-green: #76d84b;
    --scheduler-header-accent: #00b8e6;
    --scheduler-header-accent-rgb: 0, 184, 230;
    --scheduler-state-ok: var(--w-green);
    --scheduler-state-neutral: var(--secondary-text-color, #a0a0a0);
  }

  * {
    box-sizing: border-box;
  }

  ha-card {
    display: block;
    overflow: hidden;
    --ha-card-border-color: rgba(var(--scheduler-header-accent-rgb), 0.26);
  }

  ha-card:not(:defined) {
    border: 1px solid var(--ha-card-border-color);
    border-radius: var(--ha-card-border-radius, 12px);
  }

  .card-body {
    padding: 0 16px 16px;
  }

  .hero-header {
    position: relative;
    padding: 15px 20px 13px;
    overflow: hidden;
    border-bottom: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.26);
    background:
      radial-gradient(
        circle at 0 0,
        rgba(var(--scheduler-header-accent-rgb), 0.12),
        transparent 42%
      ),
      linear-gradient(
        115deg,
        rgba(var(--scheduler-header-accent-rgb), 0.055),
        rgba(127, 127, 127, 0.025) 48%,
        transparent 78%
      );
  }

  .hero-header::after {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      transparent,
      rgba(255, 255, 255, 0.018),
      transparent
    );
  }

  .hero-top {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
  }

  .hero-identity {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .hero-icon {
    width: 46px;
    height: 46px;
    flex: none;
    display: grid;
    place-items: center;
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.34);
    border-radius: 50%;
    color: var(--scheduler-header-accent);
    background: linear-gradient(
      145deg,
      rgba(var(--scheduler-header-accent-rgb), 0.18),
      rgba(var(--scheduler-header-accent-rgb), 0.055)
    );
    box-shadow:
      0 0 22px rgba(var(--scheduler-header-accent-rgb), 0.13),
      inset 0 1px 0 rgba(255, 255, 255, 0.08);
  }

  .hero-icon ha-icon {
    --mdc-icon-size: 25px;
    filter: drop-shadow(
      0 0 6px rgba(var(--scheduler-header-accent-rgb), 0.35)
    );
  }

  .hero-title-group {
    min-width: 0;
  }

  .hero-eyebrow {
    display: block;
    margin-bottom: 2px;
    color: var(--scheduler-header-accent);
    font-size: 9px;
    line-height: 1.2;
    font-weight: 800;
    letter-spacing: 1.25px;
    text-transform: uppercase;
  }

  .header-title {
    margin: 0;
    font-size: 20px;
    line-height: 1.2;
    font-weight: 700;
    letter-spacing: -0.2px;
    color: var(--primary-text-color);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  .header-right {
    display: contents;
  }

  .icon-button {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    cursor: pointer;
  }

  .icon-button:hover {
    background: rgba(127, 127, 127, 0.14);
  }

  .icon-button ha-icon {
    --mdc-icon-size: 20px;
  }

  /* Outlined chip rather than a filled pill: the state reads as a label on
     the card, not as a button competing with the toggle beside it. */
  .status {
    flex: none;
    height: 26px;
    padding: 0 9px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 1px solid currentColor;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 700;
    white-space: nowrap;
  }

  .status ha-icon {
    --mdc-icon-size: 14px;
  }

  .status-watering {
    color: var(--scheduler-header-accent);
    background: rgba(var(--scheduler-header-accent-rgb), 0.09);
  }

  .status-scheduled {
    color: var(--scheduler-state-ok);
    background: rgba(73, 190, 42, 0.09);
  }

  .status-disabled {
    color: var(--scheduler-state-neutral);
    background: rgba(127, 127, 127, 0.06);
  }

  .hero-summary {
    position: relative;
    z-index: 1;
    margin-top: 14px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: end;
    gap: 18px;
  }

  .summary-main {
    min-width: 0;
  }

  .summary-main strong {
    display: block;
    font-size: 22px;
    line-height: 1.08;
    font-weight: 750;
    letter-spacing: -0.4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .summary-main span {
    display: block;
    margin-top: 6px;
    color: var(--secondary-text-color);
    font-size: 10px;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .summary-stat {
    text-align: right;
    min-width: 88px;
  }

  .summary-stat span {
    display: block;
    font-size: 9px;
    line-height: 1.2;
    letter-spacing: 0.35px;
    text-transform: uppercase;
    color: var(--secondary-text-color);
  }

  .summary-stat strong {
    display: block;
    font-size: 20px;
    line-height: 1;
    letter-spacing: -0.25px;
    white-space: nowrap;
  }

  .summary-value-row {
    min-height: 22px;
    margin-top: 3px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .hero-rail {
    position: relative;
    z-index: 1;
    height: 4px;
    margin-top: 12px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(127, 127, 127, 0.26);
  }

  .hero-rail span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--scheduler-header-accent);
    box-shadow: 0 0 8px rgba(var(--scheduler-header-accent-rgb), 0.32);
    transition: width 0.25s linear;
  }

  .hero-rail.is-disabled {
    opacity: 0.42;
  }

  .section-title {
    margin: 0 0 8px;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 600;
    color: var(--primary-text-color);
  }

  /* With two reservoirs the section header becomes a two-column row so
     "Reservatório" and "Reservatório 2" line up with the pH/EC tiles below. */
  .section-title-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
    margin: 0 0 8px;
  }

  .section-title-row .section-title {
    margin: 0;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px;
  }

  .metric {
    min-width: 0;
    height: 44px;
    padding: 6px 8px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    text-align: left;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 7px;
    background: rgba(127, 127, 127, 0.045);
    color: var(--primary-text-color);
    cursor: pointer;
  }

  .metric:hover {
    background: rgba(127, 127, 127, 0.1);
  }

  .metric ha-icon {
    --mdc-icon-size: 19px;
    color: var(--secondary-text-color);
  }

  .metric-copy {
    min-width: 0;
  }

  .metric-copy small {
    display: block;
    margin-bottom: 1px;
    font-size: 9px;
    color: var(--secondary-text-color);
  }

  .metric-copy strong {
    display: block;
    font-size: 11px;
    line-height: 1.15;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .metric.ec-metric ha-icon,
  .metric.ec-metric .metric-copy strong {
    color: var(--primary-color, #03a9f4);
  }

  .metric.ph-metric.in-range ha-icon,
  .metric.ph-metric.in-range .metric-copy strong {
    color: var(--success-color, #4caf50);
  }

  .metric.ph-metric.out-of-range ha-icon,
  .metric.ph-metric.out-of-range .metric-copy strong {
    color: var(--error-color, #f44336);
  }

  .pot-sensors-section {
    padding-top: 0;
  }

  .pot-sensors-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .pot-sensors-heading .section-title {
    margin: 0;
  }

  .pot-history-period {
    padding: 3px 7px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 5px;
    background: rgba(127, 127, 127, 0.035);
    color: var(--secondary-text-color);
    font-family: inherit;
    font-size: 9px;
    line-height: 1.3;
    cursor: pointer;
  }

  .pot-history-period:hover,
  .pot-history-period:focus-visible {
    border-color: rgba(var(--scheduler-header-accent-rgb), 0.58);
    color: var(--scheduler-header-accent);
    outline: none;
  }

  .pot-sensors-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 5px;
  }

  /* Column flow instead of an absolutely positioned chart: the copy owns the
     top of the tile and the sparkline gets exactly what is left, so the line
     can never ride up over the name and the reading. */
  .pot-sensor-tile {
    position: relative;
    min-width: 0;
    height: 54px;
    padding: 5px 8px 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow: hidden;
    text-align: left;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    border-radius: 7px;
    background: rgba(127, 127, 127, 0.035);
    color: var(--primary-text-color);
    cursor: pointer;
  }

  .pot-sensor-tile:hover {
    border-color: rgba(var(--scheduler-header-accent-rgb), 0.42);
    background: rgba(var(--scheduler-header-accent-rgb), 0.055);
  }

  /* Identity on ONE line (drop + name + reading) instead of a stacked block:
     the sparkline is the reason this tile exists, and stacking spent more
     than half the height on text that reads just as well side by side. */
  .pot-sensor-copy {
    flex: none;
    display: flex;
    align-items: baseline;
    gap: 4px;
  }

  .pot-sensor-copy ha-icon {
    --mdc-icon-size: 13px;
    align-self: center;
    flex-shrink: 0;
    color: var(--scheduler-header-accent);
  }

  .pot-sensor-copy small,
  .pot-sensor-copy strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pot-sensor-copy small {
    flex: 1;
    min-width: 0;
    color: var(--secondary-text-color);
    font-size: 10px;
  }

  .pot-sensor-copy strong {
    flex-shrink: 0;
    font-size: 12px;
    color: var(--scheduler-header-accent);
  }

  .pot-sensor-tile svg {
    flex: 1;
    min-height: 0;
    width: 100%;
    overflow: visible;
  }

  .pot-sensor-line {
    fill: none;
    stroke: var(--scheduler-header-accent);
    stroke-width: 1.65;
    vector-effect: non-scaling-stroke;
    opacity: 0.95;
  }

  .pot-sensor-area {
    fill: rgba(var(--scheduler-header-accent-rgb), 0.11);
    stroke: none;
  }

  /* This label is the ONLY thing that explains an empty sparkline. At 8px
     and 0.8 opacity it was effectively invisible, so a card with no history
     read as "broken for no reason" -- it cost a long debugging session. */
  .pot-sensor-history-state {
    position: absolute;
    right: 7px;
    bottom: 5px;
    z-index: 1;
    padding: 1px 4px;
    border-radius: 4px;
    background: rgba(127, 127, 127, 0.14);
    color: var(--secondary-text-color);
    font-size: 10px;
    line-height: 1.2;
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
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.24);
    background: rgba(var(--scheduler-header-accent-rgb), 0.08);
    color: var(--scheduler-header-accent);
    cursor: pointer;
  }

  .refill-button:hover {
    filter: brightness(1.15);
  }

  .refill-button ha-icon {
    --mdc-icon-size: 14px;
  }

  .last-run {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 10px 16px 0;
    font-size: 10px;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .last-run ha-icon {
    --mdc-icon-size: 15px;
    flex-shrink: 0;
  }

  .last-run:hover {
    color: var(--primary-text-color);
  }

  .last-run-chevron {
    --mdc-icon-size: 15px;
    flex-shrink: 0;
  }

  .section-divider {
    height: 1px;
    background: var(--divider-color, rgba(127, 127, 127, 0.16));
    margin: 11px 16px 10px;
  }

  .history-dialog {
    width: min(90vw, 440px);
    max-height: 80vh;
    overflow-y: auto;
    box-sizing: border-box;
  }

  .history-subtitle {
    font-size: 13px;
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
    font-size: 18px;
    font-weight: 600;
  }

  .history-stat-label {
    font-size: 11px;
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
    font-size: 12px;
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
    font-size: 13px;
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

  .water-now-progress {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .water-now-timer {
    font-size: 9px;
    line-height: 1;
    color: var(--secondary-text-color);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .progress-track {
    height: 6px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(127, 127, 127, 0.28);
  }

  .progress-fill {
    height: 100%;
    border-radius: inherit;
    background: var(--primary-color, #03a9f4);
    transition: width 1s linear;
  }

  .schedules {
    display: grid;
    gap: 4px;
  }

  .schedule-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 7px;
    padding: 2px 8px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.22));
    border-radius: 6px;
    background: rgba(127, 127, 127, 0.04);
  }

  .schedule-row:hover {
    background: rgba(127, 127, 127, 0.1);
  }

  /* Geometry copied from light_scheduler's .toggle: a 30x18 rail with a
     14px knob travelling 12px. */
  .toggle {
    position: relative;
    width: 30px;
    height: 18px;
    flex: none;
    border: none;
    border-radius: 999px;
    padding: 0;
    background: none;
    cursor: pointer;
  }

  .toggle .track {
    position: absolute;
    inset: 0;
    border-radius: 999px;
    background: var(--w-green);
    transition: background 0.15s ease;
    pointer-events: none;
  }

  .toggle .thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
    transform: translateX(12px);
    transition: transform 0.15s ease;
    pointer-events: none;
  }

  .toggle.off .track {
    background: rgba(127, 127, 127, 0.4);
  }

  .toggle.off .thumb {
    transform: translateX(0);
  }

  /* Comfortable hit area without changing the 18px visual; the inset stays
     inside the header gap / row padding so it never steals a neighbour's
     clicks. */
  .toggle::before {
    content: "";
    position: absolute;
    inset: -7px -5px;
  }

  .toggle:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .toggle:focus-visible {
    outline: 2px solid var(--w-blue);
    outline-offset: 2px;
  }

  .schedule-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }

  .schedule-info-top {
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .schedule-time {
    font-size: 11px;
    line-height: 1.15;
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
    font-size: 10px;
    line-height: 1.15;
    width: 11px;
    text-align: center;
    color: var(--disabled-text-color, rgba(255, 255, 255, 0.3));
  }

  .day-initial.active {
    color: var(--primary-text-color);
    font-weight: 600;
  }

  .warning-icon {
    --mdc-icon-size: 13px;
    color: var(--warning-color, #ff9800);
    flex-shrink: 0;
  }

  .schedule-status-slot {
    width: 13px;
    height: 13px;
    flex: none;
    display: grid;
    place-items: center;
  }

  .status-icon {
    --mdc-icon-size: 13px;
    flex-shrink: 0;
  }

  .status-icon.status-done {
    color: var(--success-color, #4caf50);
  }

  .status-icon.status-pending {
    color: var(--secondary-text-color);
  }

  .schedule-duration {
    font-size: 9px;
    line-height: 1.2;
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

  .schedule-actions {
    display: flex;
    align-items: center;
    gap: 1px;
  }

  .row-action {
    width: 24px;
    height: 24px;
    padding: 0;
    display: grid;
    place-items: center;
    border: 0;
    border-radius: 50%;
    color: var(--secondary-text-color);
    background: transparent;
    cursor: pointer;
  }

  .row-action:hover {
    background: rgba(3, 169, 244, 0.14);
    color: var(--w-blue);
  }

  .row-action.delete:hover {
    background: rgba(255, 80, 80, 0.12);
    color: var(--error-color);
  }

  .row-action ha-icon {
    --mdc-icon-size: 15px;
  }

  .empty {
    padding: 16px 0;
    text-align: center;
    color: var(--secondary-text-color);
    font-size: 14px;
  }

  .add-schedule-button {
    width: 100%;
    height: 31px;
    margin-top: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.3));
    border-radius: 6px;
    background: transparent;
    color: var(--w-blue);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }

  .add-schedule-button:hover {
    background: rgba(127, 127, 127, 0.08);
  }

  .add-schedule-button ha-icon {
    --mdc-icon-size: 15px;
  }

  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    margin-top: 9px;
  }

  .actions.watering {
    gap: 10px;
  }

  .water-now-button {
    height: 31px;
    padding: 0 13px;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    background: var(--w-blue);
    color: var(--text-primary-color, #fff);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }

  .water-now-button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .water-now-button ha-icon {
    --mdc-icon-size: 15px;
  }

  .water-now-button.stop {
    background: transparent;
    border: 1px solid rgba(127, 127, 127, 0.32);
    color: var(--w-blue);
    font-weight: 500;
  }

  .water-now-button.stop ha-icon {
    --mdc-icon-size: 13px;
  }

  .config-error {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 16px;
    color: var(--error-color, #db4437);
    font-size: 14px;
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
    font-size: 16px;
    font-weight: 500;
    margin-bottom: 12px;
  }

  /* Both the schedule dialog and the settings dialog use the same rich
     header: an eyebrow, a title, and a close button -- shared here so a
     third dialog can opt in without duplicating the rule. */
  .schedule-dialog .dialog-header,
  .settings-dialog .dialog-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .schedule-dialog .dialog-header small,
  .settings-dialog .dialog-header small {
    color: var(--secondary-text-color);
    font-size: 10px;
    font-weight: 400;
  }

  .schedule-dialog .dialog-header h3,
  .settings-dialog .dialog-header h3 {
    margin: 2px 0 0;
    font-size: 18px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dialog-body {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }

  /* The settings dialog holds many fields; keep the header/actions pinned and
     let only the field list scroll on short viewports. */
  .settings-dialog {
    max-height: 90vh;
    display: flex;
    flex-direction: column;
  }

  .settings-dialog .dialog-body {
    overflow-y: auto;
    padding-right: 4px;
  }

  /* Pairs simple numeric fields two per row instead of one long column --
     the settings dialog has nine fields; stacking them all singly reads as
     an undifferentiated scroll. */
  .field-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .field-grid .field {
    min-width: 0;
  }

  .dialog-divider {
    height: 1px;
    margin: 2px 0;
    background: var(--divider-color, rgba(127, 127, 127, 0.16));
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field label {
    font-size: 13px;
    color: var(--secondary-text-color);
  }

  .field input[type="time"],
  .field input[type="number"],
  .field input[type="text"] {
    width: 100%;
    box-sizing: border-box;
    padding: 8px 10px;
    font-size: 16px;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .day-fieldset {
    margin: 0;
    padding: 0;
    border: 0;
  }

  .day-fieldset legend {
    color: var(--secondary-text-color);
    font-size: 11px;
    padding: 0;
  }

  .day-grid {
    margin-top: 7px;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }

  .day-grid input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .day-grid span {
    height: 31px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(127, 127, 127, 0.35);
    border-radius: 5px;
    color: var(--secondary-text-color);
    font-size: 10px;
    cursor: pointer;
  }

  .day-grid input:checked + span {
    border-color: var(--w-blue);
    color: var(--w-blue);
    background: rgba(3, 169, 244, 0.1);
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
    font-size: 11px;
    color: var(--secondary-text-color);
    margin-bottom: 2px;
  }

  /* Outranks the generic .field number-input rule, which otherwise forced
     this back to 16px. Staying ABOVE 16px also avoids iOS zoom-on-focus. */
  .field input.duration-segment-input {
    width: 30px;
    text-align: center;
    font-size: 18px;
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
    font-size: 18px;
    font-weight: 500;
    color: var(--primary-text-color);
  }

  .duration-preview {
    padding: 8px 10px;
    display: flex;
    align-items: center;
    gap: 7px;
    border-radius: 6px;
    color: var(--secondary-text-color);
    background: rgba(3, 169, 244, 0.08);
    font-size: 10px;
  }

  .duration-preview ha-icon {
    --mdc-icon-size: 17px;
    color: var(--w-blue);
  }

  .duration-preview strong {
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
    font-size: 16px;
    color: var(--primary-text-color);
    background: var(--input-fill-color, rgba(0, 0, 0, 0.05));
    border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    border-radius: 6px;
    color-scheme: dark;
  }

  .duration-part span {
    font-size: 13px;
    color: var(--secondary-text-color);
    flex-shrink: 0;
  }

  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 16px;
  }

  .dialog-actions button {
    padding: 8px 16px;
    font-size: 14px;
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

  .dialog-actions-spacer {
    flex: 1;
  }

  .dialog-actions .delete-button {
    display: flex;
    align-items: center;
    gap: 5px;
    padding-left: 0;
    background: transparent;
    color: var(--error-color);
  }

  .dialog-actions .delete-button ha-icon {
    --mdc-icon-size: 16px;
  }

  .schedule-dialog .dialog-actions .dialog-cancel {
    border: 1px solid rgba(127, 127, 127, 0.35);
    background: transparent;
  }

  .form-error {
    color: var(--error-color, #db4437);
    font-size: 13px;
  }

  /* Modern settings workspace: the schedule/history dialogs keep the compact
     legacy geometry above, while only the gear dialog becomes a navigable
     two-pane editor. */
  .settings-dialog {
    width: min(94vw, 820px);
    height: min(88vh, 690px);
    max-height: 690px;
    padding: 0;
    overflow: hidden;
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.25);
    border-radius: 14px;
    background: var(--card-background-color, #1c1c1c);
  }

  .settings-header {
    flex: 0 0 auto;
    min-height: 72px;
    padding: 14px 18px;
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 36px;
    align-items: center;
    gap: 12px;
    border-bottom: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    background: linear-gradient(100deg, rgba(var(--scheduler-header-accent-rgb), 0.09), transparent 48%);
  }

  .settings-header-icon {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.55);
    border-radius: 50%;
    color: var(--scheduler-header-accent);
    background: rgba(var(--scheduler-header-accent-rgb), 0.09);
  }

  .settings-header-icon ha-icon {
    --mdc-icon-size: 22px;
  }

  .settings-header small {
    color: var(--scheduler-header-accent);
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 1.1px;
  }

  .settings-header h3 {
    margin: 2px 0 0;
    font-size: 18px;
    line-height: 1.1;
  }

  .settings-header p {
    margin: 3px 0 0;
    color: var(--secondary-text-color);
    font-size: 10px;
  }

  .settings-close {
    justify-self: end;
  }

  .settings-layout {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: 190px minmax(0, 1fr);
  }

  .settings-nav {
    padding: 14px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-right: 1px solid var(--divider-color, rgba(127, 127, 127, 0.16));
    background: rgba(0, 0, 0, 0.08);
  }

  .settings-nav button {
    width: 100%;
    min-height: 42px;
    padding: 7px 9px;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr) 16px;
    align-items: center;
    gap: 7px;
    text-align: left;
    border: 1px solid transparent;
    border-radius: 7px;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .settings-nav button > ha-icon {
    --mdc-icon-size: 17px;
  }

  .settings-nav button span {
    font-size: 11px;
    font-weight: 600;
  }

  .settings-nav button small {
    display: block;
    margin-top: 1px;
    font-size: 8px;
    font-weight: 400;
  }

  .settings-nav button.active {
    border-color: rgba(var(--scheduler-header-accent-rgb), 0.26);
    background: rgba(var(--scheduler-header-accent-rgb), 0.09);
    color: var(--scheduler-header-accent);
  }

  .settings-nav .nav-chevron {
    --mdc-icon-size: 14px;
    opacity: 0;
  }

  .settings-nav button.active .nav-chevron {
    opacity: 1;
  }

  .settings-content {
    min-width: 0;
    padding: 20px 22px;
    overflow-y: auto;
  }

  .settings-section-heading {
    margin-bottom: 16px;
  }

  .settings-section-heading h4 {
    margin: 0;
    font-size: 17px;
  }

  .settings-section-heading p {
    margin: 4px 0 0;
    color: var(--secondary-text-color);
    font-size: 10px;
  }

  .settings-card-grid {
    gap: 10px;
  }

  /* The name is identity, not a metric: full width above the number grid,
     with a text input instead of the number+suffix pair. */
  .settings-name-card {
    margin-bottom: 8px;
  }

  .settings-name-card input {
    grid-column: 1 / -1;
    min-width: 0;
    width: 100%;
    box-sizing: border-box;
    padding: 6px 8px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.25));
    border-radius: 8px;
    background: rgba(127, 127, 127, 0.06);
    color: var(--primary-text-color);
    font-size: 13px;
    font-family: inherit;
  }

  .settings-name-card input:focus {
    outline: none;
    border-color: var(--scheduler-header-accent);
  }

  .settings-field-card {
    min-height: 98px;
    padding: 12px;
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    grid-template-rows: auto auto;
    align-items: start;
    gap: 6px 9px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.19));
    border-radius: 9px;
    background: rgba(127, 127, 127, 0.03);
  }

  .settings-field-icon {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 7px;
    color: var(--scheduler-header-accent);
    background: rgba(var(--scheduler-header-accent-rgb), 0.09);
  }

  .settings-field-icon ha-icon {
    --mdc-icon-size: 17px;
  }

  .settings-field-copy strong,
  .settings-field-copy small {
    display: block;
  }

  .settings-field-copy strong {
    font-size: 11px;
  }

  .settings-field-copy small {
    margin-top: 2px;
    color: var(--secondary-text-color);
    font-size: 8px;
    line-height: 1.3;
  }

  .settings-input-suffix {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .settings-input-suffix input {
    width: 92px !important;
  }

  .settings-input-suffix > span {
    color: var(--secondary-text-color);
    font-size: 10px;
  }

  .settings-estimate {
    margin-top: 12px;
    padding: 11px 13px;
    display: grid;
    grid-template-columns: 28px 1fr 1fr;
    align-items: center;
    gap: 10px;
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.2);
    border-radius: 8px;
    background: rgba(var(--scheduler-header-accent-rgb), 0.055);
  }

  .settings-estimate > ha-icon {
    --mdc-icon-size: 20px;
    color: var(--scheduler-header-accent);
  }

  .settings-estimate span,
  .settings-estimate strong {
    display: block;
  }

  .settings-estimate span {
    color: var(--secondary-text-color);
    font-size: 8px;
  }

  .settings-estimate strong {
    margin-top: 2px;
    font-size: 11px;
  }

  .settings-notice {
    margin-bottom: 12px;
    padding: 9px 11px;
    display: flex;
    align-items: center;
    gap: 7px;
    border-radius: 7px;
    background: rgba(var(--scheduler-header-accent-rgb), 0.07);
    color: var(--secondary-text-color);
    font-size: 9px;
  }

  .settings-notice ha-icon {
    --mdc-icon-size: 16px;
    color: var(--scheduler-header-accent);
  }

  .reservoir-live-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-bottom: 12px;
  }

  .reservoir-live-grid > div {
    min-height: 56px;
    padding: 10px 12px;
    display: grid;
    grid-template-columns: 26px 1fr;
    grid-template-rows: auto auto;
    align-items: center;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    border-radius: 8px;
  }

  .reservoir-live-grid ha-icon {
    --mdc-icon-size: 18px;
    grid-row: 1 / 3;
    color: var(--scheduler-header-accent);
  }

  .reservoir-live-grid span {
    color: var(--secondary-text-color);
    font-size: 8px;
  }

  .reservoir-live-grid strong {
    font-size: 14px;
  }

  .settings-form-card {
    padding: 15px;
    display: grid;
    gap: 14px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    border-radius: 9px;
    background: rgba(127, 127, 127, 0.025);
  }

  .settings-form-card .field > span {
    color: var(--primary-text-color);
    font-size: 10px;
    font-weight: 600;
  }

  .settings-form-card .field > span small {
    color: var(--secondary-text-color);
    font-weight: 400;
  }

  .settings-form-card input {
    font-size: 13px !important;
  }

  .settings-form-card .duration-row {
    align-items: end;
  }

  .settings-form-card .duration-part {
    display: grid;
    gap: 4px;
  }

  .settings-form-card .duration-part small {
    color: var(--secondary-text-color);
    font-size: 8px;
  }

  .range-separator {
    padding-bottom: 9px;
    color: var(--secondary-text-color);
    font-size: 9px;
  }

  .pot-settings-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 9px;
  }

  .pot-settings-toolbar > span {
    color: var(--secondary-text-color);
    font-size: 9px;
  }

  .pot-settings-toolbar button {
    padding: 7px 10px;
    display: flex;
    align-items: center;
    gap: 4px;
    border: 1px solid rgba(var(--scheduler-header-accent-rgb), 0.35);
    border-radius: 6px;
    background: rgba(var(--scheduler-header-accent-rgb), 0.08);
    color: var(--scheduler-header-accent);
    font-size: 10px;
    cursor: pointer;
  }

  .pot-settings-toolbar ha-icon {
    --mdc-icon-size: 14px;
  }

  .pot-settings-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pot-settings-row {
    min-height: 54px;
    padding: 7px 8px;
    display: grid;
    grid-template-columns: 18px 22px minmax(90px, 0.7fr) minmax(150px, 1.3fr) auto;
    align-items: end;
    gap: 6px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.18));
    border-radius: 7px;
    background: rgba(127, 127, 127, 0.025);
  }

  .drag-handle {
    --mdc-icon-size: 17px;
    align-self: center;
    color: var(--secondary-text-color);
    cursor: grab;
  }

  .pot-order {
    align-self: center;
    color: var(--scheduler-header-accent);
    font-size: 10px;
    font-weight: 700;
  }

  .pot-settings-row label {
    min-width: 0;
  }

  .pot-settings-row label > span {
    display: block;
    margin-bottom: 3px;
    color: var(--secondary-text-color);
    font-size: 8px;
  }

  .pot-settings-row input,
  .pot-settings-row select {
    width: 100%;
    height: 31px;
    box-sizing: border-box;
    padding: 5px 7px;
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.2));
    border-radius: 5px;
    background: var(--input-fill-color, rgba(0, 0, 0, 0.08));
    color: var(--primary-text-color);
    font-size: 10px;
    color-scheme: dark;
  }

  .pot-row-actions {
    height: 31px;
    display: flex;
    align-items: center;
  }

  .pot-row-actions button {
    width: 25px;
    height: 27px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--secondary-text-color);
    cursor: pointer;
  }

  .pot-row-actions button:disabled {
    opacity: 0.25;
  }

  .pot-row-actions button.remove:hover {
    color: var(--error-color);
  }

  .pot-row-actions ha-icon {
    --mdc-icon-size: 15px;
  }

  .pot-settings-empty {
    min-height: 210px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--secondary-text-color);
  }

  .pot-settings-empty ha-icon {
    --mdc-icon-size: 34px;
    margin-bottom: 8px;
    color: var(--scheduler-header-accent);
  }

  .pot-settings-empty strong {
    font-size: 12px;
    color: var(--primary-text-color);
  }

  .pot-settings-empty span {
    margin-top: 4px;
    font-size: 9px;
  }

  .settings-actions {
    flex: 0 0 auto;
    margin: 0;
    padding: 11px 16px;
    align-items: center;
    border-top: 1px solid var(--divider-color, rgba(127, 127, 127, 0.16));
  }

  .settings-actions > span {
    margin-right: auto;
    color: var(--secondary-text-color);
    font-size: 9px;
  }

  .settings-actions .dialog-cancel {
    border: 1px solid var(--divider-color, rgba(127, 127, 127, 0.26));
  }

  .settings-actions .dialog-save {
    display: flex;
    align-items: center;
    gap: 5px;
    background: var(--scheduler-header-accent);
  }

  .settings-actions .dialog-save ha-icon {
    --mdc-icon-size: 15px;
  }

  .compact .card-body {
    padding: 0 12px 12px;
  }

  .compact .hero-header {
    padding: 13px 16px 11px;
  }

  .compact .schedule-days,
  .compact .summary-main span,
  .compact .last-run {
    display: none;
  }

  @media (max-width: 390px) {
    .hero-header {
      padding-inline: 14px;
    }

    .hero-top {
      gap: 8px;
    }

    .hero-identity {
      gap: 8px;
    }

    .hero-icon {
      width: 40px;
      height: 40px;
    }

    .hero-icon ha-icon {
      --mdc-icon-size: 22px;
    }

    .hero-actions {
      gap: 5px;
    }

    .status {
      width: 28px;
      padding: 0;
    }

    .status > span {
      display: none;
    }

    .summary-main strong {
      font-size: 19px;
    }

    .summary-stat strong {
      font-size: 18px;
    }

    .pot-sensors-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 680px) {
    .settings-dialog {
      width: 96vw;
      height: 92vh;
    }

    .settings-header p,
    .settings-nav button span,
    .settings-nav .nav-chevron {
      display: none;
    }

    .settings-layout {
      grid-template-columns: 52px minmax(0, 1fr);
    }

    .settings-nav {
      padding-inline: 6px;
    }

    .settings-nav button {
      grid-template-columns: 1fr;
      justify-items: center;
      padding: 6px;
    }

    .settings-content {
      padding: 15px 12px;
    }

    .settings-card-grid {
      grid-template-columns: 1fr;
    }

    .pot-settings-row {
      grid-template-columns: 18px 20px 1fr auto;
    }

    .pot-settings-row label:nth-of-type(2) {
      grid-column: 3 / 5;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hero-rail span {
      transition: none;
    }
  }
`;
