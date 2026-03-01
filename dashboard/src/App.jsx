import { useState, useEffect } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function App() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    // placeholder for future auto-load if desired
  }, []);

  if (!report) {
    return (
      <div style={{ padding: 40 }}>
        <h2>NeuroFlow Dashboard</h2>
        <p>Upload a daily report to view metrics.</p>

        <input
          type="file"
          accept=".json"
          onChange={(e) => {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = () => {
              try {
                setReport(JSON.parse(reader.result));
              } catch {
                alert("Invalid JSON");
              }
            };

            reader.readAsText(file);
          }}
        />
      </div>
    );
  }

  const metrics = report.lastMinuteMetrics || {};

  const chartData = {
    labels: ["Typing", "Errors", "Mouse"],
    datasets: [
      {
        label: "Behavioral Signals",
        data: [
          metrics.typingSpeed || 0,
          metrics.errorRate || 0,
          metrics.mouseJitter || 0,
        ],
      },
    ],
  };

  return (
    <div style={{ padding: 40 }}>
      <h2>NeuroFlow Dashboard</h2>

      <div style={{ maxWidth: 600 }}>
        <Line data={chartData} />
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Summary</h3>
        <p>Typing speed: {metrics.typingSpeed || 0}</p>
        <p>Error rate: {metrics.errorRate || 0}</p>
        <p>Mouse jitter: {metrics.mouseJitter || 0}</p>
      </div>
    </div>
  );
}