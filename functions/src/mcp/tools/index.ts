/**
 * Every tool of the MCP server. A new tool goes here, with the scope it needs
 * (scopes.ts); the server lists to each assistant only the tools its token
 * was granted.
 */
import { getFeedback, listFeedback } from "./feedback";
import type { ToolDefinition } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: ToolDefinition<any>[] = [listFeedback, getFeedback];
