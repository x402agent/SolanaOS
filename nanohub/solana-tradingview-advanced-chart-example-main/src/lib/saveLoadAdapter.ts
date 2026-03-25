const CHARTS_KEY = "tradingviewCharts";
const STUDIES_KEY = "tradingviewStudies";

interface ChartInfo {
  id: string;
  timestamp: number;
  [key: string]: unknown;
}

interface StudyInfo {
  name: string;
  [key: string]: unknown;
}

export function getAllCharts(): Promise<ChartInfo[]> {
  return Promise.resolve(
    JSON.parse(localStorage.getItem(CHARTS_KEY) || "[]")
  );
}

export function removeChart(chartId: string): Promise<void> {
  let charts: ChartInfo[] = JSON.parse(
    localStorage.getItem(CHARTS_KEY) || "[]"
  );
  charts = charts.filter((c) => c.id !== chartId);
  localStorage.setItem(CHARTS_KEY, JSON.stringify(charts));
  localStorage.removeItem(`${CHARTS_KEY}.${chartId}`);
  return Promise.resolve();
}

export function saveChart(chartData: {
  content: string;
  id?: string;
  [key: string]: unknown;
}): Promise<string> {
  const { content: raw, ...info } = chartData;
  const chart = info as ChartInfo;
  if (!chart.id) chart.id = "chart" + Math.floor(Math.random() * 1e8);
  chart.timestamp = Date.now();

  let content = JSON.parse(raw);
  content["content"] = JSON.parse(content["content"]);
  try {
    const sources = content["content"]["charts"][0]["panes"][0]["sources"];
    for (let i = sources.length - 1; i >= 0; i--) {
      if (sources[i]["type"] === "study_Overlay") sources.splice(i, 1);
    }
  } catch {
  }
  content["content"] = JSON.stringify(content["content"]);

  let charts: ChartInfo[] = JSON.parse(
    localStorage.getItem(CHARTS_KEY) || "[]"
  );
  charts = charts.filter((c) => c.id !== chart.id);
  charts.push(chart);
  localStorage.setItem(CHARTS_KEY, JSON.stringify(charts));
  localStorage.setItem(`${CHARTS_KEY}.${chart.id}`, JSON.stringify(content));
  return Promise.resolve(chart.id);
}

export function getChartContent(chartId: string): Promise<string | null> {
  return Promise.resolve(
    localStorage.getItem(`${CHARTS_KEY}.${chartId}`)
  );
}

export function getAllStudyTemplates(): Promise<StudyInfo[]> {
  return Promise.resolve(
    JSON.parse(localStorage.getItem(STUDIES_KEY) || "[]")
  );
}

export function removeStudyTemplate({ name }: { name: string }): Promise<void> {
  let studies: StudyInfo[] = JSON.parse(
    localStorage.getItem(STUDIES_KEY) || "[]"
  );
  studies = studies.filter((s) => s.name !== name);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
  localStorage.removeItem(`${STUDIES_KEY}.${name}`);
  return Promise.resolve();
}

export function saveStudyTemplate({
  content,
  ...info
}: {
  content: string;
  name: string;
  [key: string]: unknown;
}): Promise<void> {
  let studies: StudyInfo[] = JSON.parse(
    localStorage.getItem(STUDIES_KEY) || "[]"
  );
  studies = studies.filter((s) => s.name !== info.name);
  studies.push(info as StudyInfo);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
  localStorage.setItem(`${STUDIES_KEY}.${info.name}`, content);
  return Promise.resolve();
}

export function getStudyTemplateContent({
  name,
}: {
  name: string;
}): Promise<string | null> {
  return Promise.resolve(
    localStorage.getItem(`${STUDIES_KEY}.${name}`)
  );
}
