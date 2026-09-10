import { Car } from "lucide-react";
import { Vehicle } from "../../api/types";
import { SectionCard } from "./SectionCard";

export function VehicleSection({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <SectionCard
      title="Vehículos"
      icon={Car}
      tint="var(--accent-2)"
      isEmpty={vehicles.length === 0}
      emptyLabel="No hay vehículos registrados."
    >
      <ul className="fact-list">
        {vehicles.map((v) => (
          <li key={v.id} className="fact-item fact-item-row">
            <div className="fact-main">
              <span>{v.plate || "Placa no disponible"}</span>
              <span className="fact-meta">
                {[v.brand, v.model, v.year, v.color, v.vehicleType].filter(Boolean).join(" · ") || "Sin detalle adicional"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}
