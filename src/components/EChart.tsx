import { useEffect, useRef } from 'react';
import { init, use } from 'echarts/core';
import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsType } from 'echarts/core';

use([
  BarChart,
  LineChart,
  HeatmapChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

export function EChart({
  option,
  height = 260,
  onClick,
}: {
  option: Record<string, unknown>;
  height?: number;
  onClick?: (payload: { name?: string; seriesName?: string; dataIndex?: number; value?: unknown }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = init(ref.current, undefined, { renderer: 'canvas' });
    const on = (params: { name?: string; seriesName?: string; dataIndex?: number; value?: unknown }) => {
      onClick?.(params);
    };
    chart.current.on('click', on);
    const ro = new ResizeObserver(() => chart.current?.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
    // onClick identity is not a layout dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div className="chart-box" ref={ref} style={{ height }} />;
}
