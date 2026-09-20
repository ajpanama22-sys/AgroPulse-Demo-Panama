import { Button } from "@/components/ui";

export default function AnalisisReportButtons({ desdeA, hastaA, desdeB, hastaB }: { desdeA: string; hastaA: string; desdeB: string; hastaB: string }) {
  const qs = new URLSearchParams({ desdeA, hastaA, desdeB, hastaB }).toString();
  return (
    <div className="flex gap-2">
      <a href={`/api/reportes/analisis/excel?${qs}`}>
        <Button variant="ghost">Excel (datos)</Button>
      </a>
      <a href={`/api/reportes/analisis/pdf?${qs}`}>
        <Button variant="primary">PDF (con gráficas)</Button>
      </a>
    </div>
  );
}
