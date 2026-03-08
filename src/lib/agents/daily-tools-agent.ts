import { Agent, run } from "@openai/agents";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const aiNewsQueries = [
  "latest artificial intelligence news developments and breakthroughs",
  "latest AI tools platforms and innovations released recently",
  "artificial intelligence research papers discoveries and technological advancements",
  "companies using artificial intelligence new applications and industry use cases",
  "artificial intelligence startups funding announcements and new products",
  "major announcements from AI companies and organizations",
  "artificial intelligence impact on industries jobs and global economy",
  "new artificial intelligence technologies inventions and systems",
  "government policies regulations and legal developments related to AI",
  "emerging trends and future developments in artificial intelligence"
];

interface LangSearchWebPage {
  name?: string;
  url?: string;
  displayUrl?: string;
  summary?: string;
  snippet?: string;
}

export async function fetchWebContext(userQuery: string) {
  const webSearchBody = {
    query: userQuery,
    freshness: "oneDay",
    summary: false,
    count: 4
  };

  const response = await axios.post<{ data?: { webPages?: { value?: LangSearchWebPage[] } } }>(`${process.env.LANGSEARCH_API_URL}`, webSearchBody, {
    headers: {
      Authorization: `Bearer ${process.env.LANGSEARCH_API_KEY}`,
      "Content-Type": "application/json"
    },
    timeout: 60 * 1000
  });

  const entries = response.data?.data?.webPages?.value ?? [];

  return entries
    .map((entry: LangSearchWebPage) => {
      const name = entry?.name?.replace(/\s+/g, " ")?.trim() || "Untitled";
      const url = entry?.url || entry?.displayUrl || "";
      const summary = entry?.summary || entry?.snippet || "No summary";

      return `Headline: ${name}\nURL: ${url}\nContent: ${summary}`;
    })
    .filter((value: string) => Boolean(value));
}

export async function buildContextString() {
  const snippets: string[] = [];

  for (const query of aiNewsQueries) {
    const entries = await fetchWebContext(query);
    for (const entry of entries) {
      snippets.push(entry);
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return snippets
    .map((snippet, index) => `${index + 1}. ${snippet}`)
    .join("\n\n");
}

export async function runDailyToolsAgent() {
  const contextString = await buildContextString();

  const agent = new Agent({
    name: "Tech News Reporter",
    instructions:
      `You are a news reporter. Use the supplied context to craft concise card-style summaries containing title, link, and why it matters.\n Use google-chat enabled response styling like italics, underline or bold. Use single asterisk for bold and not **, use underscores for italics, do not give --- for line breaks, it does not work. The heading should be Latest AI News and then today's date: which is ${new Date()}. Your final output must must contain a minimum of 10 news listings.`,
  });

  const prompt = `Generate a structured news listing using the following context:\n\n${contextString}`;

  const result = await run(agent, prompt);

  await sendFinalOutputToWebhook(result.finalOutput as string);

  return {
    generatedAt: new Date().toISOString(),
    output: result.finalOutput,
  };
}

async function sendFinalOutputToWebhook(payload: string) {
  const webhookUrl = process.env.CHAT_WEBHOOK_URL;

  if (!webhookUrl) {
    return;
  }

  try {
    await axios.post(webhookUrl, { text: payload });
  } catch (error) {
    console.error("Failed to send agent output to webhook", error instanceof Error ? error.message : error);
  }
}
