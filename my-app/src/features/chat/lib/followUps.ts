const COST_KEYWORDS = ["cost", "spend", "budget", "service", "pricing", "usage"];
const TREND_KEYWORDS = ["trend", "forecast", "month", "anomaly"];
const RESOURCE_KEYWORDS = ["resource", "instance", "ec2", "idle", "opensearch", "rds", "s3"];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

function normalizeQuestion(text: string) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;
  return normalized.endsWith("?") ? normalized : `${normalized}?`;
}

export function buildFollowUpSuggestions(userText: string, assistantText: string): string[] {
  const source = `${userText} ${assistantText}`.toLowerCase();

  if (includesAny(source, RESOURCE_KEYWORDS)) {
    return [
      "Can you show this resource cost for the last 30 days?",
      "Which AWS services are related to this resource?",
      "Can you compare this with the top cost drivers in the same account?",
    ].map(normalizeQuestion);
  }

  if (includesAny(source, TREND_KEYWORDS)) {
    return [
      "Can you show this as a month-wise cost table?",
      "What anomalies stand out in this trend?",
      "Can you compare the latest month with the previous month?",
    ].map(normalizeQuestion);
  }

  if (includesAny(source, COST_KEYWORDS)) {
    return [
      "Can you show the top AWS services in a table?",
      "What is the total cost for the last 30 days?",
      "Can you compare costs across the selected AWS accounts?",
    ].map(normalizeQuestion);
  }

  return [
    "Can you summarize the key AWS insights in a table?",
    "What should I check next based on this answer?",
    "Can you drill deeper into the most important point here?",
  ].map(normalizeQuestion);
}
