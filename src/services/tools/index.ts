import { ToolRegistry } from "./ToolRegistry";
import { clipboardTool } from "./clipboardTool";
import { webSearchTool } from "./webSearchTool";

export { ToolRegistry } from "./ToolRegistry";
export type { ToolDefinition, ToolResult } from "./ToolRegistry";

/**
 * Murmur's assistant has a deliberately small tool surface.
 *
 * Upstream also registered note CRUD, folder listing, semantic note search, and
 * calendar lookup. Those backed the notes and meetings features this fork does
 * not ship, so only the two tools that make sense for a dictation app remain:
 * reading the clipboard, and optional web search.
 */
interface ToolRegistrySettings {
  webSearchEnabled: boolean;
}

export function createToolRegistry(settings: ToolRegistrySettings): ToolRegistry {
  const registry = new ToolRegistry();
  registry.register(clipboardTool);
  if (settings.webSearchEnabled) registry.register(webSearchTool);
  return registry;
}
