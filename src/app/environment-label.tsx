"use client";
import { usePathname } from "next/navigation";
export default function EnvironmentLabel({ integrated = false }: { integrated?: boolean }) {
 const path=usePathname() ?? "/";
 const survey=path.startsWith("/surveys/")||path.startsWith("/admin/surveys");
 return <span className="demoLabel">{survey || integrated ? "Entwicklungsprototyp" : "Fiktives Beispiel"}</span>;
}
