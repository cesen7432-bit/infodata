export function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className={`brand-logo brand-logo-${size}`}>
      <span className="brand-mark">DTOS</span>
      <span className="brand-word">DataConsulta</span>
    </div>
  );
}
