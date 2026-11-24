/**
 * How a tool of the MCP server is declared. A tool names the one scope it
 * needs (scopes.ts) and reaches data only through the context it is handed:
 * adding a tool that reads something new means adding a source to the
 * context and a scope the owner approves, never handing it the database.
 */
import type { z } from "zod";
import type { Scope } from "../scopes";
import type { SupportSource } from "../supportSource";

export interface ToolContext {
  support: SupportSource;
}

export interface ToolDefinition<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  title: string;
  /** What the assistant reads to decide when to call it. */
  description: string;
  scope: Scope;
  /** True for a tool that changes nothing (all of them, for now). */
  readOnly: boolean;
  input: Shape;
  run(args: z.infer<z.ZodObject<Shape>>, context: ToolContext): Promise<unknown>;
}

export function defineTool<Shape extends z.ZodRawShape>(
  tool: ToolDefinition<Shape>,
): ToolDefinition<Shape> {
  return tool;
}

/** A tool's answer to show the assistant: what went wrong, in words. */
export class ToolInputError extends Error {}
