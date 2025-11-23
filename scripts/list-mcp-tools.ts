#!/usr/bin/env tsx

/**
 * MCP Tools List Script
 *
 * Automatically extracts and displays all registered MCP tools with their names
 * and descriptions. Since it reads directly from the MCP server code,
 * it always shows the latest information without manual updates.
 */

import { getToolInfos } from "../servers/mcp/index.js";

const tools = getToolInfos();

function getShortDescription(description: string): string {
  // Get first line or first sentence
  const firstLine = description.split("\n")[0].trim();
  // Remove markdown formatting if present
  return firstLine.replace(/\*\*/g, "").replace(/`/g, "");
}

function main(): void {
  console.log("Available MCP Tools\n");
  console.log("=".repeat(60));

  for (const tool of tools) {
    console.log(`\n${tool.name}`);
    console.log(getShortDescription(tool.description));
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total: ${tools.length} tool(s)`);
}

main();
