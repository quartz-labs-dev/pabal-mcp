#!/usr/bin/env tsx

/**
 * MCP Tools List Script
 *
 * Automatically extracts and displays all registered MCP tools with their names,
 * descriptions, and parameters. Since it reads directly from the MCP server code,
 * it always shows the latest information without manual updates.
 */

import { getToolInfos } from "../servers/mcp/index.js";
import { z } from "zod";

interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: z.ZodObject<any> | z.ZodTypeAny;
  category?: string;
}

function formatZodType(schema: z.ZodTypeAny): string {
  if (schema instanceof z.ZodString) {
    return "string";
  }
  if (schema instanceof z.ZodNumber) {
    return "number";
  }
  if (schema instanceof z.ZodBoolean) {
    return "boolean";
  }
  if (schema instanceof z.ZodArray) {
    return `array<${formatZodType(schema.element)}>`;
  }
  if (schema instanceof z.ZodEnum) {
    return `enum(${schema.options.join(", ")})`;
  }
  if (schema instanceof z.ZodObject) {
    return "object";
  }
  if (schema instanceof z.ZodOptional) {
    return formatZodType(schema._def.innerType);
  }
  if (schema instanceof z.ZodRecord) {
    return "record<string, string>";
  }
  return "unknown";
}

function extractParameterInfo(schema: z.ZodObject<any>): Array<{
  name: string;
  type: string;
  description: string;
  required: boolean;
}> {
  const shape = schema.shape;
  const params: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
  }> = [];

  for (const [key, value] of Object.entries(shape)) {
    const zodSchema = value as z.ZodTypeAny;
    const description =
      zodSchema.description || zodSchema._def?.description || "";
    const isOptional = zodSchema instanceof z.ZodOptional;
    const innerType = isOptional
      ? (zodSchema as z.ZodOptional<any>)._def.innerType
      : zodSchema;

    params.push({
      name: key,
      type: formatZodType(innerType),
      description,
      required: !isOptional,
    });
  }

  return params;
}

function formatParameter(param: {
  name: string;
  type: string;
  description: string;
  required: boolean;
}): string {
  const required = param.required ? " (required)" : " (optional)";
  return `  - ${param.name} (${param.type}): ${param.description}${required}`;
}

function printTool(tool: ToolInfo): void {
  console.log(`\n## ${tool.name}`);
  if (tool.category) {
    console.log(`Category: ${tool.category}`);
  }
  console.log(`\nDescription:\n${tool.description}\n`);

  if (tool.inputSchema && tool.inputSchema instanceof z.ZodObject) {
    const params = extractParameterInfo(tool.inputSchema);
    if (params.length > 0) {
      console.log("Parameters:");
      for (const param of params) {
        console.log(formatParameter(param));
      }
    } else {
      console.log("Parameters: none");
    }
  } else {
    console.log("Parameters: none");
  }
}

function main(): void {
  const tools = getToolInfos();

  console.log("=".repeat(60));
  console.log("Available MCP Tools");
  console.log("=".repeat(60));
  console.log(`\nTotal ${tools.length} tool(s) registered.\n`);

  // Group by category
  const toolsByCategory = tools.reduce((acc, tool) => {
    const category = tool.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {} as Record<string, ToolInfo[]>);

  for (const [category, categoryTools] of Object.entries(toolsByCategory)) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Category: ${category} (${categoryTools.length} tool(s))`);
    console.log("=".repeat(60));
    for (const tool of categoryTools) {
      printTool(tool);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Usage:");
  console.log("=".repeat(60));
  console.log(`
In Cursor/Claude Code:

1. Request using format: "Use MCP tool [tool-name] to [action]"

2. Examples:
   - "Use MCP tool ping to verify connection"
   - "Use MCP tool apps-init to register all apps from App Store"
   - "Use MCP tool aso-pull to fetch ASO data for my app"
   - "Use MCP tool release-create to create version 1.2.0"

Or mention the tool name directly:
- "Run ping"
- "Use apps-search to find my app"
- "Call aso-push to update store listing"
`);
}

main();
