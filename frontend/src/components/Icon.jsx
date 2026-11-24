// Material Symbols Outlined (font dimuat di index.html)
export default function Icon({ name, className = '', fill = false }) {
  return (
    <span
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
