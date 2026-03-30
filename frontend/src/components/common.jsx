import React from 'react';

function readStoredValue(key) {
  try {
    return typeof window !== 'undefined' && window.localStorage
      ? window.localStorage.getItem(key)
      : null;
  } catch {
    return null;
  }
}

export const API_BASE =
  (typeof window !== 'undefined' ? window.BETWEENNETWORK_API_BASE : undefined) ||
  readStoredValue('betweennetwork_api_base') ||
  'http://localhost:3000';

export const STORAGE_KEYS = {
  token: 'betweennetwork_admin_token',
  admin: 'betweennetwork_admin_profile'
};

export function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function escapeText(value) {
  return value || '-';
}

export function toneFromStatus(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized.includes('ACTIVE') || normalized.includes('APPROVED')) return 'success';
  if (normalized.includes('REJECT') || normalized.includes('REVOK')) return 'danger';
  if (normalized.includes('REVIEW') || normalized.includes('PENDING') || normalized.includes('SUSPEND')) return 'warning';
  return 'neutral';
}

export function StatusBadge({ status }) {
  return <span className={`badge ${toneFromStatus(status)}`}>{String(status || '-').toUpperCase()}</span>;
}

export function DetailRow({ label, value, status }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{status ? <StatusBadge status={value} /> : escapeText(value)}</dd>
    </div>
  );
}
