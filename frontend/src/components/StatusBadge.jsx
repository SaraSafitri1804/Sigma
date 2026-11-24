import Icon from './Icon';

const MAP = {
  valid: { label: 'Valid', icon: 'check_circle', cls: 'bg-status-valid-container text-on-status-valid-container' },
  revoked: { label: 'Dicabut', icon: 'cancel', cls: 'bg-status-revoked-container text-on-status-revoked-container' },
  invalid: { label: 'Tidak Valid', icon: 'warning', cls: 'bg-status-invalid-container text-on-status-invalid-container whitespace-nowrap' },
};

export default function StatusBadge({ status }) {
  const s = MAP[status] || MAP.invalid;
  return (
    <span role="status" className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full ${s.cls}`}>
      <Icon name={s.icon} className="text-label-sm" />
      <span className="font-body text-label-sm">{s.label}</span>
    </span>
  );
}
