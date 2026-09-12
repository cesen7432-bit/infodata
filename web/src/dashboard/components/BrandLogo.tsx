export function BrandLogo({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <div className={`brand-logo brand-logo-${size}`}>
      <span className="brand-mark">ID</span>
      <span className="brand-word">InfoData</span>
    </div>
  );
}
