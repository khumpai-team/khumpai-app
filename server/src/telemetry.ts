import 'dotenv/config';
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

export function initTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.log('[telemetry] APPLICATIONINSIGHTS_CONNECTION_STRING not set — observability disabled');
    return;
  }

  try {
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString,
      },
    });
    console.log('[telemetry] Azure Application Insights enabled');
  } catch (err) {
    console.error('[telemetry] Failed to initialize Azure Monitor — server continues without observability:', err);
  }
}
