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
    instructions: `You are an AI news reporter. Use the supplied context to generate concise, high-signal news summaries formatted for Google Chat.

Formatting rules:
- Use *single asterisks* for bold text.
- Use _underscores_ for italics.
- Do NOT use **double asterisks**.
- Do NOT use --- or any horizontal separators.
- Keep formatting compatible with Google Chat messages.

Output structure:

Start with the heading:

*Latest AI News – ${new Date().toDateString()}*

Then list the news items.

Requirements:
- Provide a minimum of 10 news items.
- Each item must be numbered.
- Each item must contain:
  1. A clear headline
  2. The source URL
  3. A short explanation of why the news matters
- Keep each summary concise and informative (1–2 sentences).

Format example:

Latest AI News — <Current Date as provided>

1. *Headline of the News*
<URL>
_Why it matters:_ Brief explanation of the significance of the news.

2. *Headline of the News*
<URL>
_Why it matters:_ Brief explanation of the significance.

Continue the same format for all items.`,
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
