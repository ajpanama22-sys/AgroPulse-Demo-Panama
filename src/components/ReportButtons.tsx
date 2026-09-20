"use client";

import { Button } from "@/components/ui";

export default function ReportButtons() {
  return (
    <div className="flex gap-2">
      <a href="/api/reportes/excel">
        <Button variant="ghost">Exportar Excel</Button>
      </a>
      <a href="/api/reportes/pdf">
        <Button variant="primary">Reporte PDF</Button>
      </a>
    </div>
  );
}
