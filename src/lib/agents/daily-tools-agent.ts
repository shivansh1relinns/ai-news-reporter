import { Agent, run } from "@openai/agents";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const aiNewsQueries = [
  "new AI model released benchmark LLM diffusion transformer past 14 days",
  "OpenAI Anthropic Google Meta Mistral new AI model announcement",
  "new open source LLM or AI model released GitHub HuggingFace",
  "new artificial intelligence research paper breakthrough transformer agent architecture",
  
  "new AI developer tool SDK API framework launch GitHub AI agents",
  "new AI coding assistant platform or agent framework released",
  "AI startup launches developer platform or API for building AI applications",

  "enterprise AI platform launch automation agents for companies",
  "AI SaaS product launch for business automation or workflow automation",
  
  "voice AI agent platform launch speech to speech conversational AI",
  "AI phone call agent startup launch voice automation platform",
  "real time voice AI SDK or speech AI API release",
  "AI call center automation platform voice bot product launch",

  "new AI productivity tool launch for business users management teams",
  "AI tool for sales automation or AI sales assistant launch",
  "AI marketing automation platform launch content generation marketing AI",
  "AI meeting assistant or AI workplace productivity tool launch",
  "AI tool for customer support automation product launch",
  "AI CRM assistant or AI sales outreach tool announcement",

  "AI startup funding announcement with product launch AI platform",
  "startup launches AI tool for businesses or teams",

  "new AI chip GPU accelerator announcement Nvidia AMD AI hardware",
  "new AI infrastructure or cloud ML platform release",

  "new open source AI framework or agent system GitHub release",
  "trending GitHub AI repository machine learning or AI agents"
];

interface FirecrawlSearchItem {
  title?: string;
  url?: string;
  description?: string;
  markdown?: string;
  content?: string;
  snippet?: string;
}

interface FirecrawlSearchResponse {
  success?: boolean;
  data?: FirecrawlSearchItem[];
}

const FIRECRAWL_SEARCH_URL = process.env.FIRECRAWL_API_URL || "https://api.firecrawl.dev/v1/search";

function truncate(input: string, maxLength: number) {
  if (input.length <= maxLength) {
    return input;
  }

  return `${input.slice(0, maxLength).trimEnd()}...`;
}

export async function fetchWebContext(userQuery: string) {
  const firecrawlApiKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlApiKey) {
    throw new Error("FIRECRAWL_API_KEY is missing.");
  }

  const webSearchBody = {
    query: userQuery,
    limit: 4,
    scrapeOptions: {
      formats: ["markdown"],
      onlyMainContent: true,
    },
  };

  const response = await axios.post<FirecrawlSearchResponse>(FIRECRAWL_SEARCH_URL, webSearchBody, {
    headers: {
      Authorization: `Bearer ${firecrawlApiKey}`,
      "Content-Type": "application/json"
    },
    timeout: 60 * 1000
  });

  if (response.data?.success === false) {
    throw new Error("Firecrawl search request failed.");
  }

  const entries = response.data?.data ?? [];

  return entries
    .map((entry: FirecrawlSearchItem) => {
      const name = entry?.title?.replace(/\s+/g, " ")?.trim() || "Untitled";
      const url = entry?.url || "";
      const rawSummary = entry?.description || entry?.snippet || entry?.content || entry?.markdown || "No summary";
      const summary = truncate(rawSummary.replace(/\s+/g, " ").trim(), 500);

      return `Headline: ${name}\nURL: ${url}\nContent: ${summary}`;
    })
    .filter((value: string) => Boolean(value));
}

export async function buildContextString() {
  const snippets: string[] = [];
  const seenUrls = new Set<string>();

  for (const query of aiNewsQueries) {
    const entries = await fetchWebContext(query);
    for (const entry of entries) {
      const urlMatch = entry.match(/URL:\s*(.+)/);
      const url = urlMatch?.[1]?.trim();

      if (url && seenUrls.has(url)) {
        continue;
      }

      if (url) {
        seenUrls.add(url);
      }

      snippets.push(entry);
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
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
