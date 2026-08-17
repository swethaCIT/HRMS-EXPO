/**
 * Self-contained onboarding portal — plain HTML/CSS/vanilla JS, no build
 * step. Served by OnboardNotifyPortalController (see module doc for why this
 * lives on the backend rather than a new frontend package).
 *
 * Design tokens below are lifted directly from the mobile app's shared `T`/
 * `TINT` objects (apps/mobile/src/data/managerData.ts) so this reads as the
 * same product, not a bolted-on web form — same indigo/ink palette, same
 * system-font stack, same card/shadow/radius conventions used throughout the
 * HR Onboard Notify mobile screens.
 *
 * The session JWT lives in localStorage under `onboardingPortal.token` so a
 * candidate who closes the tab and comes back later resumes without logging
 * in again, until they explicitly log out or the token expires.
 */
export function renderOnboardingPortalPage(nonce: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Employee Onboarding Portal</title>
<style>
  :root {
    --header: #1E1B4B;
    --header-alt: #312E81;
    --primary: #4F46E5;
    --primary-dark: #4338CA;
    --primary-soft: #EEF2FF;
    --bg: #F3F4F6;
    --card: #FFFFFF;
    --ink: #1F2937;
    --sub: #6B7280;
    --faint: #9CA3AF;
    --line: #E5E7EB;
    --line-strong: #D1D5DB;
    --green-fg: #065F46; --green-bg: #D1FAE5; --green-solid: #10B981;
    --amber-fg: #B45309; --amber-bg: #FEF3C7; --amber-solid: #F59E0B;
    --red-fg: #991B1B; --red-bg: #FEE2E2; --red-solid: #EF4444;
    --blue-fg: #2563EB; --blue-bg: #DBEAFE; --blue-solid: #3B82F6;
    --radius-sm: 8px;
    --radius-md: 12px;
    --radius-lg: 16px;
    --shadow-card: 0 1px 2px rgba(16,24,40,0.04), 0 2px 6px rgba(16,24,40,0.06);
    --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--ink);
    -webkit-font-smoothing: antialiased;
    line-height: 1.5;
  }
  h1, h2, h3, p, ul { margin: 0; }
  button { font-family: inherit; }
  ::selection { background: var(--primary-soft); color: var(--primary-dark); }
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }

  /* ── focus ── */
  a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible, [tabindex]:focus-visible {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  /* ── layout shell ── */
  .topbar {
    background: var(--header);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 24px;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .brand { display: flex; align-items: center; gap: 12px; }
  .brand-mark {
    width: 36px; height: 36px; border-radius: 9px;
    background: rgba(255,255,255,0.14);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 14px; letter-spacing: 0.02em;
    flex: none;
  }
  .brand-text { display: flex; flex-direction: column; line-height: 1.25; }
  .brand-title { font-size: 14px; font-weight: 700; }
  .brand-sub { font-size: 11.5px; color: rgba(255,255,255,0.65); }
  .topbar-right { display: flex; align-items: center; gap: 14px; }
  .topbar-name { font-size: 13px; color: rgba(255,255,255,0.85); font-weight: 600; }
  .btn-logout {
    background: rgba(255,255,255,0.12); color: #fff; border: none; border-radius: var(--radius-sm);
    padding: 8px 14px; font-size: 12.5px; font-weight: 600; cursor: pointer;
  }
  .btn-logout:hover { background: rgba(255,255,255,0.2); }

  .shell { max-width: 880px; margin: 0 auto; padding: 32px 24px 80px; }
  .shell-narrow { max-width: 640px; margin: 0 auto; padding: 32px 24px 80px; }

  /* ── auth (login / change password) ── */
  .auth-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: var(--bg); }
  .auth-card {
    width: 100%; max-width: 400px; background: var(--card); border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card); padding: 36px 32px; display: flex; flex-direction: column; gap: 22px;
  }
  .auth-brand { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; }
  .auth-mark {
    width: 52px; height: 52px; border-radius: 14px; background: var(--header);
    display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 18px;
  }
  .auth-eyebrow { font-size: 12px; font-weight: 700; color: var(--primary); letter-spacing: 0.06em; text-transform: uppercase; }
  .auth-title { font-size: 20px; font-weight: 700; color: var(--ink); }
  .auth-dek { font-size: 13.5px; color: var(--sub); line-height: 1.5; }
  .auth-help { text-align: center; font-size: 12.5px; color: var(--faint); }

  /* ── typography scale ── */
  .page-title { font-size: 26px; font-weight: 700; letter-spacing: -0.01em; color: var(--ink); }
  .page-dek { font-size: 14.5px; color: var(--sub); margin-top: 4px; }
  .section-title { font-size: 18px; font-weight: 700; color: var(--ink); }
  .section-dek { font-size: 13.5px; color: var(--sub); margin-top: 3px; line-height: 1.5; }
  .eyebrow { font-size: 11.5px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--sub); }

  /* ── card ── */
  .card { background: var(--card); border-radius: var(--radius-lg); box-shadow: var(--shadow-card); padding: 28px; margin-bottom: 20px; }
  .card-header { margin-bottom: 22px; }

  /* ── alerts ── */
  .alert { border-radius: var(--radius-md); padding: 16px 18px; display: flex; gap: 12px; align-items: flex-start; margin-bottom: 20px; }
  .alert-icon { flex: none; width: 22px; height: 22px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; margin-top: 1px; }
  .alert-body { flex: 1; }
  .alert-title { font-size: 13.5px; font-weight: 700; margin-bottom: 3px; }
  .alert-text { font-size: 13px; line-height: 1.5; }
  .alert-info { background: var(--blue-bg); } .alert-info .alert-icon { background: var(--blue-solid); color: #fff; } .alert-info .alert-title, .alert-info .alert-text { color: var(--blue-fg); }
  .alert-success { background: var(--green-bg); } .alert-success .alert-icon { background: var(--green-solid); color: #fff; } .alert-success .alert-title, .alert-success .alert-text { color: var(--green-fg); }
  .alert-warning { background: var(--amber-bg); } .alert-warning .alert-icon { background: var(--amber-solid); color: #fff; } .alert-warning .alert-title, .alert-warning .alert-text { color: var(--amber-fg); }
  .alert-error { background: var(--red-bg); } .alert-error .alert-icon { background: var(--red-solid); color: #fff; } .alert-error .alert-title, .alert-error .alert-text { color: var(--red-fg); }

  /* ── buttons ── */
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; border-radius: var(--radius-sm); font-weight: 700; font-size: 14px; cursor: pointer; padding: 12px 22px; white-space: nowrap; }
  .btn:disabled { opacity: 0.55; cursor: not-allowed; }
  .btn-primary { background: var(--primary); color: #fff; }
  .btn-primary:hover:not(:disabled) { background: var(--primary-dark); }
  .btn-secondary { background: var(--primary-soft); color: var(--primary); }
  .btn-secondary:hover:not(:disabled) { background: #E0E4FD; }
  .btn-ghost { background: transparent; color: var(--sub); }
  .btn-ghost:hover:not(:disabled) { color: var(--ink); }
  .btn-danger { background: var(--red-bg); color: var(--red-fg); }
  .btn-block { width: 100%; }
  .btn-row { display: flex; gap: 10px; align-items: center; justify-content: flex-end; margin-top: 26px; padding-top: 20px; border-top: 1px solid var(--line); }
  .btn-row.split { justify-content: space-between; }
  .spinner { width: 15px; height: 15px; border-radius: 999px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: spin 0.7s linear infinite; }
  .spinner-dark { border: 2px solid rgba(79,70,229,0.25); border-top-color: var(--primary); }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* ── fields ── */
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 20px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field.full { grid-column: 1 / -1; }
  .field-label { font-size: 13px; font-weight: 600; color: var(--ink); display: flex; gap: 4px; }
  .required-mark { color: var(--red-solid); }
  .field-helper { font-size: 12px; color: var(--faint); line-height: 1.45; }
  .field-error { font-size: 12px; font-weight: 600; color: var(--red-fg); display: none; align-items: center; gap: 5px; }
  .field.has-error .field-error { display: flex; }
  .field.has-error .input, .field.has-error select, .field.has-error textarea { border-color: var(--red-solid); background: #FFFBFA; }
  .input, select, textarea {
    font-family: inherit; font-size: 14px; color: var(--ink); background: #fff;
    border: 1.5px solid var(--line-strong); border-radius: var(--radius-sm); padding: 11px 13px; width: 100%;
  }
  .input:focus, select:focus, textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-soft); outline: none; }
  .input:disabled, select:disabled, textarea:disabled { background: var(--bg); color: var(--faint); cursor: not-allowed; }
  textarea { resize: vertical; min-height: 84px; }
  select { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236B7280' stroke-width='1.5' fill='none' fill-rule='evenodd'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 34px; }
  .save-hint { font-size: 12px; color: var(--green-fg); font-weight: 600; display: flex; align-items: center; gap: 5px; opacity: 0; transition: opacity 0.2s ease; }
  .save-hint.show { opacity: 1; }

  .radio-group, .checkbox-row { display: flex; align-items: center; gap: 8px; }
  .checkbox-row { font-size: 13px; color: var(--sub); }
  .checkbox-row input { width: 16px; height: 16px; accent-color: var(--primary); }

  /* ── badges / status pills ── */
  .pill { display: inline-flex; align-items: center; gap: 6px; border-radius: 999px; padding: 5px 11px; font-size: 11.5px; font-weight: 700; }
  .pill-done { background: var(--green-bg); color: var(--green-fg); }
  .pill-action { background: var(--amber-bg); color: var(--amber-fg); }
  .pill-todo { background: var(--bg); color: var(--sub); }
  .pill-locked { background: var(--bg); color: var(--faint); }

  /* ── progress bar ── */
  .progress-track { height: 8px; border-radius: 999px; background: var(--line); overflow: hidden; }
  .progress-fill { height: 100%; background: var(--primary); border-radius: 999px; transition: width 0.3s ease; }

  /* ── stepper ── */
  .stepper { display: flex; align-items: flex-start; overflow-x: auto; padding: 4px 2px 18px; margin-bottom: 8px; scrollbar-width: thin; }
  .step { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; min-width: 84px; position: relative; cursor: default; background: none; border: none; padding: 0; font-family: inherit; }
  .step.clickable { cursor: pointer; }
  .step-line { position: absolute; top: 13px; left: -50%; width: 100%; height: 2px; background: var(--line); z-index: 0; }
  .step:first-child .step-line { display: none; }
  .step-line.done { background: var(--green-solid); }
  .step-dot { width: 26px; height: 26px; border-radius: 999px; background: #fff; border: 2px solid var(--line-strong); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: var(--faint); z-index: 1; flex: none; }
  .step-dot.done { background: var(--green-solid); border-color: var(--green-solid); color: #fff; }
  .step-dot.current { background: var(--primary); border-color: var(--primary); color: #fff; }
  .step-dot.flagged { background: var(--red-solid); border-color: var(--red-solid); color: #fff; }
  .step-dot.locked { background: var(--bg); }
  .step-label { font-size: 10.5px; font-weight: 600; color: var(--sub); text-align: center; line-height: 1.3; max-width: 84px; }
  .step-label.current { color: var(--primary); }
  .step-compact { display: none; }

  /* ── section list (dashboard) ── */
  .section-list { display: flex; flex-direction: column; gap: 10px; }
  .section-row {
    display: flex; align-items: center; gap: 14px; padding: 15px 16px; border-radius: var(--radius-md);
    background: var(--bg); border: 1px solid transparent; text-align: left; width: 100%; cursor: pointer; font-family: inherit;
  }
  .section-row:hover { border-color: var(--line-strong); }
  .section-row.locked { cursor: default; opacity: 0.6; }
  .section-row.flagged { background: var(--red-bg); }
  .section-status-icon { width: 30px; height: 30px; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 800; flex: none; }
  .section-status-icon.done { background: var(--green-solid); color: #fff; }
  .section-status-icon.action { background: var(--amber-solid); color: #fff; }
  .section-status-icon.todo { background: #fff; color: var(--faint); border: 1.5px solid var(--line-strong); }
  .section-status-icon.flagged { background: var(--red-solid); color: #fff; }
  .section-status-icon.locked { background: #fff; color: var(--faint); border: 1.5px solid var(--line); }
  .section-row-main { flex: 1; min-width: 0; }
  .section-row-title { font-size: 14.5px; font-weight: 600; color: var(--ink); }
  .section-row-meta { font-size: 12px; color: var(--sub); margin-top: 2px; }
  .section-row-meta.flagged-text { color: var(--red-fg); font-weight: 600; }
  .section-row-arrow { color: var(--faint); font-size: 17px; flex: none; }

  /* ── dropzone ── */
  .doc-slot { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 18px; margin-bottom: 14px; }
  .doc-slot-head { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 4px; gap: 8px; }
  .doc-slot-title { font-size: 14px; font-weight: 700; color: var(--ink); display: flex; align-items: center; gap: 6px; }
  .doc-slot-helper { font-size: 12px; color: var(--faint); margin-bottom: 12px; }
  .dropzone {
    border: 1.5px dashed var(--line-strong); border-radius: var(--radius-md); padding: 26px 16px; text-align: center;
    background: var(--bg); cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
  }
  .dropzone.dragover { border-color: var(--primary); background: var(--primary-soft); }
  .dropzone-icon { font-size: 22px; margin-bottom: 8px; }
  .dropzone-text { font-size: 13.5px; color: var(--ink); font-weight: 600; }
  .dropzone-or { font-size: 11.5px; color: var(--faint); margin: 8px 0; }
  .dropzone-meta { font-size: 11.5px; color: var(--faint); margin-top: 10px; }
  .doc-file-row { display: flex; align-items: center; gap: 12px; background: var(--green-bg); border-radius: var(--radius-sm); padding: 12px 14px; }
  .doc-file-icon { width: 30px; height: 30px; border-radius: 999px; background: var(--green-solid); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; flex: none; font-size: 13px; }
  .doc-file-info { flex: 1; min-width: 0; }
  .doc-file-name { font-size: 13.5px; font-weight: 600; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .doc-file-status { font-size: 11.5px; color: var(--green-fg); font-weight: 600; }
  .doc-file-actions { display: flex; gap: 6px; flex: none; }
  .doc-file-actions button { font-size: 11.5px; padding: 6px 10px; }
  .doc-progress { height: 4px; border-radius: 999px; background: var(--line); overflow: hidden; margin-top: 10px; }
  .doc-progress-fill { height: 100%; background: var(--primary); width: 40%; animation: indeterminate 1.1s ease-in-out infinite; }
  @keyframes indeterminate { 0% { transform: translateX(-100%); } 100% { transform: translateX(250%); } }

  /* ── repeatable records ── */
  .repeat-item { border: 1px solid var(--line); border-radius: var(--radius-md); padding: 20px; margin-bottom: 16px; position: relative; }
  .repeat-item-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
  .repeat-item-title { font-size: 12.5px; font-weight: 700; color: var(--sub); text-transform: uppercase; letter-spacing: 0.04em; }
  .repeat-remove { background: none; border: none; color: var(--red-fg); font-size: 12px; font-weight: 700; cursor: pointer; padding: 4px 6px; }

  /* ── review page ── */
  .review-section { margin-bottom: 18px; }
  .review-section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .review-row { display: flex; justify-content: space-between; gap: 16px; padding: 9px 0; border-bottom: 1px solid var(--line); font-size: 13.5px; }
  .review-row:last-child { border-bottom: none; }
  .review-k { color: var(--sub); flex: none; width: 42%; }
  .review-v { color: var(--ink); font-weight: 600; text-align: right; flex: 1; }
  .review-record { padding: 12px 0; border-bottom: 1px solid var(--line); }
  .review-record:last-child { border-bottom: none; }

  /* ── success ── */
  .success-wrap { text-align: center; padding: 50px 24px; }
  .success-check { width: 68px; height: 68px; border-radius: 999px; background: var(--green-bg); color: var(--green-solid); display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: 800; margin: 0 auto 22px; animation: pop 0.35s ease; }
  @keyframes pop { from { transform: scale(0.7); opacity: 0; } to { transform: scale(1); opacity: 1; } }
  .success-title { font-size: 22px; font-weight: 700; color: var(--ink); margin-bottom: 10px; }
  .success-text { font-size: 14px; color: var(--sub); max-width: 440px; margin: 0 auto; line-height: 1.6; }

  /* ── toast ── */
  #toast { position: fixed; top: 18px; left: 50%; transform: translateX(-50%) translateY(-12px); background: var(--ink); color: #fff; padding: 11px 20px; border-radius: var(--radius-sm); font-size: 13px; font-weight: 600; box-shadow: 0 8px 24px rgba(0,0,0,0.18); opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 100; }
  #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  .center-loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; }

  /* ── responsive ── */
  @media (max-width: 720px) {
    .shell, .shell-narrow { padding: 20px 16px 100px; }
    .card { padding: 20px; border-radius: var(--radius-md); }
    .form-grid { grid-template-columns: 1fr; gap: 16px; }
    .page-title { font-size: 22px; }
    .stepper { display: none; }
    .step-compact { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; font-size: 12.5px; color: var(--sub); font-weight: 600; }
    .btn-row { position: sticky; bottom: 0; background: var(--card); margin: 24px -20px -20px; padding: 16px 20px; border-radius: 0 0 var(--radius-md) var(--radius-md); }
    .topbar { padding: 12px 16px; }
    .topbar-name { display: none; }
    .auth-card { padding: 28px 22px; }
  }
</style>
</head>
<body>
<div id="app"></div>
<div id="toast" role="status" aria-live="polite"></div>

<script nonce="${nonce}">
(function () {
  var apiBase = window.location.pathname.replace(/\\/$/, '');
  var STORAGE_KEY = 'onboardingPortal.token';
  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;
  var state = { token: null, mustChangePassword: false, dashboard: null, view: 'loading', activeSection: null, errors: {} };

  /* ══════════ field schema ══════════ */
  var SECTION_META = {
    personalDetails: {
      description: 'Basic information required for your employee profile.',
      fields: [
        { key: 'fullName', label: 'Full Name', type: 'text', required: true, helper: 'Enter your name exactly as it appears on your identity document.' },
        { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: true },
        { key: 'gender', label: 'Gender', type: 'select', required: true, options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
        { key: 'maritalStatus', label: 'Marital Status', type: 'select', required: true, options: ['Single', 'Married', 'Other'] },
        { key: 'nationality', label: 'Nationality', type: 'text', required: true },
      ],
    },
    contactInfo: {
      description: 'How HR can reach you during onboarding and after you join.',
      fields: [
        { key: 'personalEmail', label: 'Personal Email', type: 'email', required: true },
        { key: 'mobile', label: 'Mobile Number', type: 'tel', required: true, helper: 'Enter a valid 10-digit mobile number.', pattern: 'mobile' },
        { key: 'alternateNumber', label: 'Alternate Number', type: 'tel', required: false },
        { key: 'currentAddress', label: 'Current Address', type: 'textarea', required: true, full: true },
        { key: 'permanentAddress', label: 'Permanent Address', type: 'textarea', required: true, full: true, sameAsCurrent: true },
      ],
    },
    emergencyContact: {
      description: 'Who should we contact in case of an emergency.',
      fields: [
        { key: 'name', label: 'Full Name', type: 'text', required: true },
        { key: 'relationship', label: 'Relationship', type: 'select', required: true, options: ['Father', 'Mother', 'Spouse', 'Sibling', 'Friend', 'Other'] },
        { key: 'phone', label: 'Phone Number', type: 'tel', required: true, pattern: 'mobile' },
        { key: 'address', label: 'Address', type: 'textarea', required: false, full: true },
      ],
    },
    bankDetails: {
      description: 'Used to set up your salary account — double-check these carefully.',
      fields: [
        { key: 'accountHolderName', label: 'Account Holder Name', type: 'text', required: true },
        { key: 'bankName', label: 'Bank Name', type: 'text', required: true },
        { key: 'accountNumber', label: 'Account Number', type: 'text', required: true },
        { key: 'ifsc', label: 'IFSC Code', type: 'text', required: true },
        { key: 'branch', label: 'Branch', type: 'text', required: false },
      ],
    },
  };

  var REPEAT_META = {
    education: {
      description: 'Add each qualification, starting with the most recent.',
      itemLabel: 'Education Record',
      fields: [
        { key: 'qualification', label: 'Qualification', type: 'select', required: true, options: ['10th', '12th', 'Diploma', "Bachelor's", "Master's", 'Doctorate', 'Other'] },
        { key: 'institution', label: 'Institution', type: 'text', required: true },
        { key: 'universityBoard', label: 'University / Board', type: 'text', required: true },
        { key: 'passingYear', label: 'Passing Year', type: 'text', required: true },
        { key: 'percentageCgpa', label: 'Percentage / CGPA', type: 'text', required: true },
      ],
    },
    employmentHistory: {
      description: 'Add each previous employer, starting with the most recent.',
      itemLabel: 'Employment Record',
      fields: [
        { key: 'companyName', label: 'Company Name', type: 'text', required: true },
        { key: 'designation', label: 'Designation', type: 'text', required: true },
        { key: 'employmentType', label: 'Employment Type', type: 'select', required: true, options: ['Full-time', 'Part-time', 'Contract', 'Internship'] },
        { key: 'startDate', label: 'Start Date', type: 'date', required: true },
        { key: 'endDate', label: 'End Date', type: 'date', required: false },
        { key: 'totalExperience', label: 'Total Experience', type: 'text', required: false },
        { key: 'reasonForLeaving', label: 'Reason for Leaving', type: 'textarea', required: false, full: true },
        { key: 'employerHrContact', label: 'Employer HR Contact Name', type: 'text', required: false },
        { key: 'employerHrEmail', label: 'Employer HR Email', type: 'email', required: false },
        { key: 'employerHrPhone', label: 'Employer HR Phone', type: 'tel', required: false },
        { key: 'officeLocation', label: 'Office Location', type: 'text', required: false },
      ],
    },
  };

  var COMMON_DOC_SLOTS = [
    { category: 'photo', label: 'Photograph', helper: 'A recent passport-style photo.' },
    { category: 'identity_proof', label: 'Identity Proof', helper: 'Aadhaar, Passport, or other government-issued ID.' },
    { category: 'pan', label: 'PAN Card', helper: 'Clear scan or photo of your PAN card.' },
    { category: 'education_certificate', label: 'Education Certificates', helper: 'Your highest qualification certificate.' },
    { category: 'bank_proof', label: 'Bank Proof', helper: 'Cancelled cheque or bank statement showing your account details.' },
  ];
  var EXPERIENCED_DOC_SLOTS = [
    { category: 'experience_certificate', label: 'Experience Certificate', helper: '' },
    { category: 'relieving_letter', label: 'Relieving Letter', helper: '' },
    { category: 'payslip', label: 'Last 3 Payslips', helper: 'Upload each payslip separately.', multiple: true },
    { category: 'employment_proof', label: 'Employment Proof', helper: '' },
  ];

  var SECTION_ICON = { personalDetails: '\\uD83D\\uDC64', contactInfo: '\\u2709', emergencyContact: '\\u2695', education: '\\uD83C\\uDF93', bankDetails: '\\uD83C\\uDFE6', employmentHistory: '\\uD83D\\uDCBC', documents: '\\uD83D\\uDCC1' };

  /* ══════════ tiny DOM + fetch helpers ══════════ */
  function el(tag, attrs, children) {
    var e = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'checked') e.checked = attrs[k];
      else if (k === 'disabled') e.disabled = attrs[k];
      else if (k === 'for') e.setAttribute('for', attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = opts.headers || {};
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    return fetch(apiBase + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body instanceof FormData ? opts.body : (opts.body ? JSON.stringify(opts.body) : undefined),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (!res.ok) { var err = new Error(body.message || 'Something went wrong. Please try again.'); err.status = res.status; throw err; }
        return body;
      });
    });
  }

  function saveToken(token) {
    state.token = token;
    try { localStorage.setItem(STORAGE_KEY, token); } catch (e) {}
  }
  function clearToken() {
    state.token = null;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  function firstName(full) { return (full || '').split(' ')[0] || full; }

  /* ══════════ render dispatch ══════════ */
  function render() {
    app.innerHTML = '';
    if (state.view === 'login') app.appendChild(loginView());
    else if (state.view === 'changePassword') app.appendChild(changePasswordView());
    else if (state.view === 'dashboard') app.appendChild(withTopbar(dashboardView()));
    else if (state.view === 'section') app.appendChild(withTopbar(sectionView(state.activeSection)));
    else if (state.view === 'review') app.appendChild(withTopbar(reviewView()));
    else if (state.view === 'success') app.appendChild(withTopbar(successView()));
    else app.appendChild(el('div', { class: 'center-loading' }, [spinner(true)]));
  }

  function spinner(dark) {
    return el('div', { class: 'spinner' + (dark ? ' spinner-dark' : '') });
  }

  function withTopbar(content) {
    var wrap = el('div', {});
    var logout = el('button', { class: 'btn-logout', type: 'button', text: 'Log Out' });
    logout.addEventListener('click', function () { clearToken(); state.dashboard = null; state.view = 'login'; render(); });
    var name = state.dashboard ? state.dashboard.record.tempName : '';
    wrap.appendChild(el('div', { class: 'topbar' }, [
      el('div', { class: 'brand' }, [
        el('div', { class: 'brand-mark', text: 'H' }),
        el('div', { class: 'brand-text' }, [
          el('span', { class: 'brand-title', text: 'Employee Onboarding Portal' }),
          el('span', { class: 'brand-sub', text: 'HRMS' }),
        ]),
      ]),
      el('div', { class: 'topbar-right' }, [
        name ? el('span', { class: 'topbar-name', text: name }) : null,
        logout,
      ]),
    ]));
    wrap.appendChild(content);
    return wrap;
  }

  /* ══════════ Login ══════════ */
  function loginView() {
    var wrap = el('div', { class: 'auth-wrap' });
    var card = el('div', { class: 'auth-card' });
    card.appendChild(el('div', { class: 'auth-brand' }, [
      el('div', { class: 'auth-mark', text: 'H' }),
      el('div', {}, [
        el('div', { class: 'auth-eyebrow', text: 'Secure Company Portal' }),
        el('div', { class: 'auth-title', text: 'Employee Onboarding Portal' }),
      ]),
      el('p', { class: 'auth-dek', text: 'Complete your onboarding information securely.' }),
    ]));

    var msg = el('div', {});
    card.appendChild(msg);

    var loginId = el('input', { class: 'input', id: 'loginId', autocomplete: 'username' });
    var password = el('input', { class: 'input', id: 'loginPassword', type: 'password', autocomplete: 'current-password' });
    card.appendChild(el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'loginId', text: 'Login ID' }), loginId]));
    card.appendChild(el('div', { class: 'field' }, [el('label', { class: 'field-label', for: 'loginPassword', text: 'Password' }), password]));

    var btn = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, [el('span', { text: 'Sign In' })]);
    function doLogin() {
      if (!loginId.value.trim() || !password.value) {
        msg.innerHTML = '';
        msg.appendChild(alertBox('error', 'Missing information', 'Enter both your Login ID and password.'));
        return;
      }
      btn.disabled = true;
      btn.innerHTML = '';
      btn.appendChild(spinner());
      api('/login', { method: 'POST', body: { loginId: loginId.value.trim(), password: password.value } })
        .then(function (r) {
          saveToken(r.token);
          state.mustChangePassword = r.mustChangePassword;
          if (r.mustChangePassword) { state.view = 'changePassword'; render(); return; }
          loadDashboard();
        })
        .catch(function (e) {
          msg.innerHTML = '';
          msg.appendChild(alertBox('error', 'Sign-in failed', e.message));
          btn.disabled = false;
          btn.innerHTML = '';
          btn.appendChild(el('span', { text: 'Sign In' }));
        });
    }
    btn.addEventListener('click', doLogin);
    password.addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
    card.appendChild(btn);

    card.appendChild(el('p', { class: 'auth-help', text: 'Need help? Contact your HR representative.' }));
    wrap.appendChild(card);
    return wrap;
  }

  /* ══════════ Forced password change ══════════ */
  function changePasswordView() {
    var wrap = el('div', { class: 'auth-wrap' });
    var card = el('div', { class: 'auth-card' });
    card.appendChild(el('div', { class: 'auth-brand' }, [
      el('div', { class: 'auth-mark', text: 'H' }),
      el('div', { class: 'auth-title', text: 'Create Your Password' }),
      el('p', { class: 'auth-dek', text: 'For your security, please create a new password before continuing.' }),
    ]));

    var msg = el('div', {});
    card.appendChild(msg);

    var current = el('input', { class: 'input', type: 'password', autocomplete: 'current-password' });
    var next = el('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    var confirm = el('input', { class: 'input', type: 'password', autocomplete: 'new-password' });
    card.appendChild(el('div', { class: 'field' }, [el('label', { class: 'field-label', text: 'Temporary Password' }), current]));
    card.appendChild(el('div', { class: 'field' }, [
      el('label', { class: 'field-label', text: 'New Password' }), next,
      el('span', { class: 'field-helper', text: 'At least 8 characters, and different from your temporary password.' }),
    ]));
    card.appendChild(el('div', { class: 'field' }, [el('label', { class: 'field-label', text: 'Confirm New Password' }), confirm]));

    var btn = el('button', { class: 'btn btn-primary btn-block', type: 'button' }, [el('span', { text: 'Continue to Onboarding' })]);
    btn.addEventListener('click', function () {
      msg.innerHTML = '';
      if (next.value.length < 8) { msg.appendChild(alertBox('error', "Password too short", 'Use at least 8 characters.')); return; }
      if (next.value !== confirm.value) { msg.appendChild(alertBox('error', "Passwords don't match", 'Re-enter your new password so both fields match.')); return; }
      btn.disabled = true;
      btn.innerHTML = '';
      btn.appendChild(spinner());
      api('/change-password', { method: 'POST', body: { currentPassword: current.value, newPassword: next.value } })
        .then(function (r) { saveToken(r.token); loadDashboard(); })
        .catch(function (e) {
          msg.innerHTML = '';
          msg.appendChild(alertBox('error', 'Could not update password', e.message));
          btn.disabled = false;
          btn.innerHTML = '';
          btn.appendChild(el('span', { text: 'Continue to Onboarding' }));
        });
    });
    card.appendChild(btn);
    wrap.appendChild(card);
    return wrap;
  }

  function alertBox(kind, title, text) {
    var iconMap = { info: 'i', success: '\\u2713', warning: '!', error: '!' };
    return el('div', { class: 'alert alert-' + kind, role: kind === 'error' ? 'alert' : 'status' }, [
      el('span', { class: 'alert-icon', text: iconMap[kind] }),
      el('div', { class: 'alert-body' }, [
        el('div', { class: 'alert-title', text: title }),
        el('div', { class: 'alert-text', text: text }),
      ]),
    ]);
  }

  /* ══════════ Stepper ══════════ */
  function stepper(activeKey) {
    var d = state.dashboard;
    var wrap = el('div', { class: 'stepper' });
    d.sectionOrder.forEach(function (s, i) {
      var done = d.sectionsDone[s.key];
      var editable = d.editableSections.indexOf(s.key) !== -1;
      var flagged = d.correction && (d.correction.sections || []).some(function (c) { return c.section === s.key; });
      var isCurrent = s.key === activeKey;
      var dotClass = 'step-dot' + (flagged ? ' flagged' : done ? ' done' : isCurrent ? ' current' : !editable ? ' locked' : '');
      var lineClass = 'step-line' + (done ? ' done' : '');
      var step = el('button', { class: 'step' + (editable ? ' clickable' : ''), type: 'button', disabled: !editable }, [
        i > 0 ? el('span', { class: lineClass }) : null,
        el('span', { class: dotClass, text: flagged ? '!' : done ? '\\u2713' : String(i + 1) }),
        el('span', { class: 'step-label' + (isCurrent ? ' current' : ''), text: s.label }),
      ]);
      if (editable) step.addEventListener('click', function () { state.activeSection = s.key; state.view = 'section'; render(); });
      wrap.appendChild(step);
    });
    var compact = el('div', { class: 'step-compact' });
    var idx = d.sectionOrder.map(function (s) { return s.key; }).indexOf(activeKey) + 1;
    compact.appendChild(el('span', { text: 'Section ' + idx + ' of ' + d.sectionOrder.length }));
    compact.appendChild(el('span', { text: (state.dashboard.completionPercent) + '% complete' }));
    var holder = el('div', {});
    holder.appendChild(wrap);
    holder.appendChild(compact);
    return holder;
  }

  /* ══════════ Dashboard ══════════ */
  function dashboardView() {
    var d = state.dashboard;
    var wrap = el('div', { class: 'shell' });

    if (d.status === 'submitted' || d.status === 'hr_review') {
      wrap.appendChild(alertBox('success', 'Submitted — awaiting HR review', 'Your onboarding information has been submitted successfully. HR will review it and contact you if any corrections are required.'));
    } else if (d.correction) {
      var sections = (d.correction.sections || []);
      var box = el('div', { class: 'alert alert-warning' }, [
        el('span', { class: 'alert-icon', text: '!' }),
        el('div', { class: 'alert-body' }, [
          el('div', { class: 'alert-title', text: 'Action Required' }),
          el('div', { class: 'alert-text', text: 'HR has requested an update to your onboarding information.' + (d.correction.comments ? ' ' + d.correction.comments : '') }),
        ]),
      ]);
      wrap.appendChild(box);
      sections.forEach(function (c) {
        var card = el('div', { class: 'card', style: 'padding:16px 18px;margin-bottom:12px' }, [
          el('div', { class: 'section-title', style: 'font-size:14.5px', text: (d.sectionOrder.filter(function (s) { return s.key === c.section; })[0] || {}).label || c.section }),
          el('div', { class: 'section-dek', style: 'color:var(--red-fg);font-weight:600', text: '"' + c.reason + '"' }),
        ]);
        var goBtn = el('button', { class: 'btn btn-secondary', type: 'button', style: 'margin-top:12px', text: 'Review & Correct' });
        goBtn.addEventListener('click', function () { state.activeSection = c.section; state.view = 'section'; render(); });
        card.appendChild(goBtn);
        wrap.appendChild(card);
      });
    } else if (d.status === 'approved' || d.status === 'forwarded' || d.status === 'completed') {
      wrap.appendChild(alertBox('success', 'Onboarding Approved', 'Your onboarding has been approved. No further action is needed from you.'));
    }

    var head = el('div', { style: 'margin-bottom:22px' }, [
      el('h1', { class: 'page-title', text: greeting() + ', ' + firstName(d.record.tempName) }),
      el('p', { class: 'page-dek', text: 'Welcome to your onboarding portal — ' + (d.record.employeeType === 'experienced' ? 'Experienced Hire' : 'Fresher') + ' onboarding, reference ' + d.record.onboardingRef + '.' }),
    ]);
    wrap.appendChild(head);

    var progressCard = el('div', { class: 'card' });
    progressCard.appendChild(el('div', { class: 'card-header' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px' }, [
        el('span', { class: 'eyebrow', text: 'Onboarding Progress' }),
        el('span', { style: 'font-size:22px;font-weight:800;color:var(--primary)', text: d.completionPercent + '%' }),
      ]),
      el('div', { class: 'progress-track' }, [el('div', { class: 'progress-fill', style: 'width:' + d.completionPercent + '%' })]),
      el('p', { class: 'section-dek', style: 'margin-top:10px', text: Object.values(d.sectionsDone).filter(Boolean).length + ' of ' + d.sectionOrder.length + ' sections completed' }),
    ]));

    var list = el('div', { class: 'section-list' });
    var firstIncomplete = null;
    d.sectionOrder.forEach(function (s) {
      var done = d.sectionsDone[s.key];
      var editable = d.editableSections.indexOf(s.key) !== -1;
      var flagged = d.correction && (d.correction.sections || []).some(function (c) { return c.section === s.key; });
      if (!done && editable && !firstIncomplete) firstIncomplete = s.key;
      var iconClass = flagged ? 'flagged' : done ? 'done' : editable ? 'action' : 'locked';
      var iconText = flagged ? '!' : done ? '\\u2713' : editable ? '\\u2192' : '\\uD83D\\uDD12';
      var metaText = flagged ? 'Correction requested' : done ? 'Completed' : editable ? 'Action required' : 'Not available yet';
      var row = el('button', { class: 'section-row' + (flagged ? ' flagged' : '') + (!editable ? ' locked' : ''), type: 'button', disabled: !editable }, [
        el('span', { class: 'section-status-icon ' + iconClass, text: iconText }),
        el('div', { class: 'section-row-main' }, [
          el('div', { class: 'section-row-title', text: s.label }),
          el('div', { class: 'section-row-meta' + (flagged ? ' flagged-text' : ''), text: metaText }),
        ]),
        editable ? el('span', { class: 'section-row-arrow', text: '\\u203A' }) : null,
      ]);
      if (editable) row.addEventListener('click', function () { state.activeSection = s.key; state.view = 'section'; render(); });
      list.appendChild(row);
    });
    progressCard.appendChild(list);
    wrap.appendChild(progressCard);

    if (firstIncomplete) {
      var cont = el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Continue Onboarding' });
      cont.addEventListener('click', function () { state.activeSection = firstIncomplete; state.view = 'section'; render(); });
      wrap.appendChild(cont);
    } else if (d.editableSections.length && d.completionPercent === 100) {
      var reviewBtn = el('button', { class: 'btn btn-primary btn-block', type: 'button', text: 'Review & Submit' });
      reviewBtn.addEventListener('click', function () { state.view = 'review'; render(); });
      wrap.appendChild(reviewBtn);
    }

    return wrap;
  }

  /* ══════════ Section editor ══════════ */
  function validateField(fieldDef, value) {
    value = (value || '').toString().trim();
    if (fieldDef.required && !value) return 'This field is required.';
    if (value && fieldDef.type === 'email' && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) return 'Enter a valid email address.';
    if (value && fieldDef.pattern === 'mobile' && !/^\\d{10}$/.test(value.replace(/\\D/g, ''))) return 'Please enter a valid 10-digit mobile number.';
    return null;
  }

  function renderField(fieldDef, value, onChange) {
    var fieldId = 'f_' + fieldDef.key + '_' + Math.random().toString(36).slice(2, 7);
    var wrapper = el('div', { class: 'field' + (fieldDef.full ? ' full' : '') });
    var labelChildren = [el('span', { text: fieldDef.label })];
    if (fieldDef.required) labelChildren.push(el('span', { class: 'required-mark', text: '*' }));
    wrapper.appendChild(el('label', { class: 'field-label', for: fieldId }, labelChildren));

    var input;
    if (fieldDef.type === 'select') {
      input = el('select', { id: fieldId });
      input.appendChild(el('option', { value: '', text: 'Select…' }));
      fieldDef.options.forEach(function (opt) { input.appendChild(el('option', { value: opt, text: opt })); });
      input.value = value || '';
    } else if (fieldDef.type === 'textarea') {
      input = el('textarea', { id: fieldId });
      input.value = value || '';
    } else {
      input = el('input', { class: 'input', id: fieldId, type: fieldDef.type === 'tel' ? 'tel' : fieldDef.type });
      input.value = value || '';
    }
    wrapper.appendChild(input);

    if (fieldDef.helper) wrapper.appendChild(el('span', { class: 'field-helper', text: fieldDef.helper }));
    var errorEl = el('span', { class: 'field-error', role: 'alert' }, [el('span', { text: '\\u26A0' }), el('span', { 'data-error-text': '' })]);
    wrapper.appendChild(errorEl);

    input.addEventListener('input', function () { onChange(input.value); wrapper.classList.remove('has-error'); });
    input.addEventListener('change', function () { onChange(input.value); });

    return { wrapper: wrapper, input: input, setError: function (msg) {
      if (msg) { wrapper.classList.add('has-error'); errorEl.querySelector('[data-error-text]').textContent = msg; }
      else wrapper.classList.remove('has-error');
    } };
  }

  function sectionView(key) {
    var d = state.dashboard;
    var wrap = el('div', { class: 'shell' });
    wrap.appendChild(stepper(key));

    var label = (d.sectionOrder.filter(function (s) { return s.key === key; })[0] || {}).label || key;
    var card = el('div', { class: 'card' });

    if (key === 'documents') {
      card.appendChild(el('div', { class: 'card-header' }, [
        el('h2', { class: 'section-title', text: label }),
        el('p', { class: 'section-dek', text: 'Upload clear PDF, JPG or PNG files — max 10 MB each.' }),
      ]));
      card.appendChild(documentsEditor());
      var backBtn = el('div', { class: 'btn-row' }, [(function () {
        var b = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Back to Dashboard' });
        b.addEventListener('click', function () { state.view = 'dashboard'; render(); });
        return b;
      })()]);
      card.appendChild(backBtn);
    } else if (REPEAT_META[key]) {
      card.appendChild(el('div', { class: 'card-header' }, [
        el('h2', { class: 'section-title', text: label }),
        el('p', { class: 'section-dek', text: REPEAT_META[key].description }),
      ]));
      card.appendChild(repeatEditor(key));
    } else {
      card.appendChild(el('div', { class: 'card-header' }, [
        el('h2', { class: 'section-title', text: label }),
        el('p', { class: 'section-dek', text: SECTION_META[key].description }),
      ]));
      card.appendChild(simpleEditor(key));
    }

    wrap.appendChild(card);
    return wrap;
  }

  function nextIncompleteAfter(key) {
    var d = state.dashboard;
    var keys = d.sectionOrder.map(function (s) { return s.key; });
    var idx = keys.indexOf(key);
    for (var i = idx + 1; i < keys.length; i++) {
      if (!d.sectionsDone[keys[i]] && d.editableSections.indexOf(keys[i]) !== -1) return keys[i];
    }
    for (var j = 0; j < keys.length; j++) {
      if (!d.sectionsDone[keys[j]] && d.editableSections.indexOf(keys[j]) !== -1) return keys[j];
    }
    return null;
  }

  function simpleEditor(key) {
    var box = el('div', {});
    var grid = el('div', { class: 'form-grid' });
    var existing = (state.dashboard.response && state.dashboard.response[key]) || {};
    var refs = {};
    var meta = SECTION_META[key];

    meta.fields.forEach(function (fieldDef) {
      var f = renderField(fieldDef, existing[fieldDef.key], function () {});
      refs[fieldDef.key] = f;
      grid.appendChild(f.wrapper);
      if (fieldDef.sameAsCurrent && refs.currentAddress) {
        var row = el('label', { class: 'checkbox-row', style: 'margin-top:-8px;grid-column:1/-1' });
        var cb = el('input', { type: 'checkbox' });
        row.appendChild(cb);
        row.appendChild(el('span', { text: 'Same as current address' }));
        cb.addEventListener('change', function () {
          if (cb.checked) { f.input.value = refs.currentAddress.input.value; f.setError(null); }
        });
        grid.appendChild(row);
      }
    });
    box.appendChild(grid);

    var msg = el('div', { style: 'margin-top:16px' });
    box.appendChild(msg);

    var actions = el('div', { class: 'btn-row split' });
    var exitBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Save & Exit' });
    var continueBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [el('span', { text: 'Save & Continue' })]);

    function collectAndValidate() {
      var data = {}; var valid = true;
      meta.fields.forEach(function (fieldDef) {
        var val = refs[fieldDef.key].input.value;
        data[fieldDef.key] = val;
        var err = validateField(fieldDef, val);
        refs[fieldDef.key].setError(err);
        if (err) valid = false;
      });
      return { data: data, valid: valid };
    }

    function doSave(after) {
      var result = collectAndValidate();
      msg.innerHTML = '';
      if (!result.valid) { msg.appendChild(alertBox('error', 'Please fix the highlighted fields', 'A few required fields still need your attention.')); return; }
      exitBtn.disabled = true; continueBtn.disabled = true;
      api('/sections/' + key, { method: 'PUT', body: { data: result.data } })
        .then(function (d) {
          state.dashboard = d;
          showToast('Saved just now');
          after(d);
        })
        .catch(function (e) {
          msg.innerHTML = '';
          msg.appendChild(alertBox('error', 'Could not save', e.message));
          exitBtn.disabled = false; continueBtn.disabled = false;
        });
    }
    exitBtn.addEventListener('click', function () { doSave(function () { state.view = 'dashboard'; render(); }); });
    continueBtn.addEventListener('click', function () {
      doSave(function (d) {
        var next = nextIncompleteAfter(key);
        if (next) { state.activeSection = next; state.view = 'section'; }
        else state.view = 'dashboard';
        render();
      });
    });

    actions.appendChild(exitBtn);
    actions.appendChild(continueBtn);
    box.appendChild(actions);
    return box;
  }

  function repeatEditor(key) {
    var box = el('div', {});
    var listWrap = el('div', {});
    var meta = REPEAT_META[key];
    var existing = ((state.dashboard.response && state.dashboard.response[key] && state.dashboard.response[key].records) || []).slice();
    if (!existing.length) existing = [{}];
    var rows = [];

    function renderRows() {
      listWrap.innerHTML = '';
      rows = [];
      existing.forEach(function (item, idx) {
        var refs = {};
        var itemBox = el('div', { class: 'repeat-item' });
        itemBox.appendChild(el('div', { class: 'repeat-item-head' }, [
          el('span', { class: 'repeat-item-title', text: meta.itemLabel + ' ' + (idx + 1) }),
          existing.length > 1 ? (function () {
            var rm = el('button', { class: 'repeat-remove', type: 'button', text: 'Remove' });
            rm.addEventListener('click', function () { existing.splice(idx, 1); renderRows(); });
            return rm;
          })() : null,
        ]));
        var grid = el('div', { class: 'form-grid' });
        meta.fields.forEach(function (fieldDef) {
          var f = renderField(fieldDef, item[fieldDef.key], function () {});
          refs[fieldDef.key] = f;
          grid.appendChild(f.wrapper);
        });
        itemBox.appendChild(grid);
        rows.push(refs);
        listWrap.appendChild(itemBox);
      });
    }
    renderRows();
    box.appendChild(listWrap);

    var addBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: '+ Add Another ' + meta.itemLabel });
    addBtn.addEventListener('click', function () { existing.push({}); renderRows(); });
    box.appendChild(addBtn);

    var msg = el('div', { style: 'margin-top:16px' });
    box.appendChild(msg);

    var actions = el('div', { class: 'btn-row split' });
    var exitBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Save & Exit' });
    var continueBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [el('span', { text: 'Save & Continue' })]);

    function collectAndValidate() {
      var valid = true;
      var records = rows.map(function (refs) {
        var r = {};
        Object.keys(refs).forEach(function (k) {
          var fieldDef = meta.fields.filter(function (f) { return f.key === k; })[0];
          var val = refs[k].input.value;
          r[k] = val;
          var err = validateField(fieldDef, val);
          refs[k].setError(err);
          if (err) valid = false;
        });
        return r;
      });
      return { records: records, valid: valid };
    }

    function doSave(after) {
      var result = collectAndValidate();
      msg.innerHTML = '';
      if (!result.valid) { msg.appendChild(alertBox('error', 'Please fix the highlighted fields', 'A few required fields still need your attention.')); return; }
      exitBtn.disabled = true; continueBtn.disabled = true;
      api('/sections/' + key, { method: 'PUT', body: { data: { records: result.records } } })
        .then(function (d) {
          state.dashboard = d;
          showToast('Saved just now');
          after(d);
        })
        .catch(function (e) {
          msg.innerHTML = '';
          msg.appendChild(alertBox('error', 'Could not save', e.message));
          exitBtn.disabled = false; continueBtn.disabled = false;
        });
    }
    exitBtn.addEventListener('click', function () { doSave(function () { state.view = 'dashboard'; render(); }); });
    continueBtn.addEventListener('click', function () {
      doSave(function (d) {
        var next = nextIncompleteAfter(key);
        if (next) { state.activeSection = next; state.view = 'section'; }
        else state.view = 'dashboard';
        render();
      });
    });
    actions.appendChild(exitBtn);
    actions.appendChild(continueBtn);
    box.appendChild(actions);
    return box;
  }

  /* ══════════ Documents ══════════ */
  function documentsEditor() {
    var box = el('div', {});
    var slots = COMMON_DOC_SLOTS.concat(state.dashboard.record.employeeType === 'experienced' ? EXPERIENCED_DOC_SLOTS : []);
    var docs = (state.dashboard.response && state.dashboard.response.documents) || [];

    slots.forEach(function (slot) {
      var slotBox = el('div', { class: 'doc-slot' });
      slotBox.appendChild(el('div', { class: 'doc-slot-head' }, [
        el('div', { class: 'doc-slot-title', text: slot.label }),
      ]));
      if (slot.helper) slotBox.appendChild(el('div', { class: 'doc-slot-helper', text: slot.helper }));

      var body = el('div', {});
      slotBox.appendChild(body);
      box.appendChild(slotBox);

      function renderSlotBody() {
        body.innerHTML = '';
        var uploaded = docs.filter(function (d) { return d.category === slot.category; });
        uploaded.forEach(function (docItem) { body.appendChild(fileRow(docItem, renderSlotBody, docs)); });
        if (!uploaded.length || slot.multiple) body.appendChild(dropzone(slot, function (updated) { docs = updated; renderSlotBody(); }));
      }
      renderSlotBody();
    });

    return box;
  }

  function fileRow(docItem, onChanged, docsRef) {
    var row = el('div', { class: 'doc-file-row', style: 'margin-bottom:10px' });
    row.appendChild(el('div', { class: 'doc-file-icon', text: '\\u2713' }));
    row.appendChild(el('div', { class: 'doc-file-info' }, [
      el('div', { class: 'doc-file-name', text: docItem.name }),
      el('div', { class: 'doc-file-status', text: 'Uploaded successfully' }),
    ]));
    var actions = el('div', { class: 'doc-file-actions' });
    var removeBtn = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Remove' });
    removeBtn.addEventListener('click', function () {
      removeBtn.disabled = true;
      api('/documents/' + docItem.id, { method: 'DELETE' })
        .then(function (updated) {
          state.dashboard.response.documents = updated;
          onChanged(updated);
        })
        .catch(function (e) { showToast(e.message || 'Could not remove file'); removeBtn.disabled = false; });
    });
    actions.appendChild(removeBtn);
    row.appendChild(actions);
    return row;
  }

  function dropzone(slot, onChanged) {
    var zone = el('div', { class: 'dropzone', tabindex: '0', role: 'button', 'aria-label': 'Upload ' + slot.label });
    var fileInput = el('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.webp', style: 'display:none' });
    var content = el('div', {}, [
      el('div', { class: 'dropzone-icon', text: '\\u2B06' }),
      el('div', { class: 'dropzone-text', text: 'Drag & drop your file here' }),
      el('div', { class: 'dropzone-or', text: 'or' }),
      el('button', { class: 'btn btn-secondary', type: 'button', text: 'Choose File' }),
      el('div', { class: 'dropzone-meta', text: 'PDF, JPG, WEBP or PNG · Max 10 MB' }),
    ]);
    zone.appendChild(content);
    zone.appendChild(fileInput);

    function upload(file) {
      if (!file) return;
      zone.innerHTML = '';
      zone.appendChild(el('div', { class: 'dropzone-text', text: 'Uploading ' + file.name + '…' }));
      zone.appendChild(el('div', { class: 'doc-progress' }, [el('div', { class: 'doc-progress-fill' })]));
      var fd = new FormData();
      fd.append('file', file);
      fd.append('category', slot.category);
      api('/documents', { method: 'POST', body: fd })
        .then(function (docs) { state.dashboard.response.documents = docs; onChanged(docs); })
        .catch(function (e) { showToast(e.message || 'Upload failed'); onChanged(state.dashboard.response.documents); });
    }

    zone.addEventListener('click', function () { fileInput.click(); });
    zone.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
    fileInput.addEventListener('change', function () { upload(fileInput.files[0]); });
    ['dragenter', 'dragover'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(function (evt) {
      zone.addEventListener(evt, function (e) { e.preventDefault(); zone.classList.remove('dragover'); });
    });
    zone.addEventListener('drop', function (e) {
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) upload(file);
    });
    return zone;
  }

  /* ══════════ Review & Submit ══════════ */
  function humanize(k) { return k.replace(/([A-Z])/g, ' $1').replace(/^./, function (c) { return c.toUpperCase(); }); }

  function reviewView() {
    var d = state.dashboard;
    var wrap = el('div', { class: 'shell' });
    wrap.appendChild(stepper('review'));
    wrap.appendChild(el('div', { style: 'margin-bottom:20px' }, [
      el('h1', { class: 'page-title', text: 'Review Your Information' }),
      el('p', { class: 'page-dek', text: 'Please review your information before submitting. You can edit any section below.' }),
    ]));

    var msg = el('div', {});
    wrap.appendChild(msg);

    d.sectionOrder.forEach(function (s) {
      var card = el('div', { class: 'card', style: 'padding:22px' });
      var head = el('div', { class: 'review-section-head' }, [
        el('h2', { class: 'section-title', style: 'font-size:15px', text: s.label }),
      ]);
      var editBtn = el('button', { class: 'btn btn-ghost', type: 'button', style: 'padding:6px 10px', text: 'Edit' });
      editBtn.addEventListener('click', function () { state.activeSection = s.key; state.view = 'section'; render(); });
      head.appendChild(editBtn);
      card.appendChild(head);

      if (s.key === 'documents') {
        (d.response && d.response.documents || []).forEach(function (doc) {
          card.appendChild(el('div', { class: 'review-row' }, [
            el('span', { class: 'review-k', text: '\\u2713 ' + humanize(doc.category) }),
            el('span', { class: 'review-v', text: doc.name }),
          ]));
        });
      } else if (REPEAT_META[s.key]) {
        var records = (d.response && d.response[s.key] && d.response[s.key].records) || [];
        records.forEach(function (r, i) {
          var recBox = el('div', { class: 'review-record' });
          recBox.appendChild(el('div', { style: 'font-size:11.5px;font-weight:700;color:var(--faint);text-transform:uppercase;margin-bottom:4px', text: REPEAT_META[s.key].itemLabel + ' ' + (i + 1) }));
          Object.keys(r).forEach(function (k) {
            if (!r[k]) return;
            recBox.appendChild(el('div', { class: 'review-row' }, [el('span', { class: 'review-k', text: humanize(k) }), el('span', { class: 'review-v', text: r[k] })]));
          });
          card.appendChild(recBox);
        });
      } else {
        var data = (d.response && d.response[s.key]) || {};
        Object.keys(data).forEach(function (k) {
          if (!data[k]) return;
          card.appendChild(el('div', { class: 'review-row' }, [el('span', { class: 'review-k', text: humanize(k) }), el('span', { class: 'review-v', text: data[k] })]));
        });
      }
      wrap.appendChild(card);
    });

    var actions = el('div', { class: 'btn-row split' });
    var backBtn = el('button', { class: 'btn btn-secondary', type: 'button', text: 'Back' });
    backBtn.addEventListener('click', function () { state.view = 'dashboard'; render(); });
    var submitBtn = el('button', { class: 'btn btn-primary', type: 'button' }, [el('span', { text: 'Submit Onboarding' })]);
    submitBtn.addEventListener('click', function () {
      submitBtn.disabled = true; backBtn.disabled = true;
      submitBtn.innerHTML = ''; submitBtn.appendChild(spinner());
      api('/submit', { method: 'POST' })
        .then(function (d2) { state.dashboard = d2; state.view = 'success'; render(); })
        .catch(function (e) {
          msg.innerHTML = '';
          msg.appendChild(alertBox('error', 'Could not submit', e.message));
          submitBtn.disabled = false; backBtn.disabled = false;
          submitBtn.innerHTML = ''; submitBtn.appendChild(el('span', { text: 'Submit Onboarding' }));
        });
    });
    actions.appendChild(backBtn);
    actions.appendChild(submitBtn);
    wrap.appendChild(actions);
    return wrap;
  }

  /* ══════════ Success ══════════ */
  function successView() {
    var d = state.dashboard;
    var wrap = el('div', { class: 'shell-narrow' });
    var box = el('div', { class: 'success-wrap' }, [
      el('div', { class: 'success-check', text: '\\u2713' }),
      el('div', { class: 'success-title', text: 'Onboarding Submitted' }),
      el('p', { class: 'success-text', text: 'Thank you, ' + firstName(d.record.tempName) + '. Your onboarding information has been successfully submitted. HR will review your information and contact you if any corrections are required.' }),
    ]);
    var btn = el('button', { class: 'btn btn-primary', type: 'button', text: 'Back to Dashboard', style: 'margin-top:26px' });
    btn.addEventListener('click', function () { state.view = 'dashboard'; render(); });
    box.appendChild(btn);
    wrap.appendChild(box);
    return wrap;
  }

  /* ══════════ boot ══════════ */
  function loadDashboard() {
    state.view = 'loading'; render();
    api('/me').then(function (d) {
      state.dashboard = d;
      state.view = 'dashboard';
      render();
    }).catch(function (e) {
      if (e.status === 403 && /temporary password/i.test(e.message)) { state.view = 'changePassword'; render(); return; }
      clearToken();
      state.view = 'login';
      render();
    });
  }

  function init() {
    var stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch (e) {}
    if (stored) { state.token = stored; loadDashboard(); }
    else { state.view = 'login'; render(); }
  }

  init();
})();
</script>
</body>
</html>`;
}
