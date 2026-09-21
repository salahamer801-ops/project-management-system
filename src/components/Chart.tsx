import { useEffect, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  DoughnutController,
  LineController,
  BarController,
  PieController,
  type ChartConfiguration,
} from "chart.js";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
  DoughnutController,
  LineController,
  BarController,
  PieController
);

export function Chart({
  type,
  data,
  options,
  height = 260,
}: {
  type: "doughnut" | "bar" | "line" | "pie";
  data: any;
  options?: any;
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<ChartJS | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const config: ChartConfiguration = {
      type,
      data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom", rtl: true, labels: { font: { family: "Tajawal" } } },
        },
        ...options,
      },
    };
    try {
      chartRef.current = new ChartJS(canvasRef.current, config);
    } catch (err) {
      console.error("chart init failed", err);
    }
    return () => {
      chartRef.current?.destroy();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), type]);

  return (
    <div style={{ height }} className="relative">
      <canvas ref={canvasRef} />
    </div>
  );
}
