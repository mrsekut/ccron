export type McpServerEntry = {
  type: string;
  url: string;
};

const MCP_PRESETS: Record<string, McpServerEntry> = {
  slack: {
    type: 'http',
    url: 'https://mcp.slack.com/mcp',
  },
  linear: {
    type: 'http',
    url: 'https://mcp.linear.app/mcp',
  },
};

export function getPresetNames(): string[] {
  return Object.keys(MCP_PRESETS);
}

export function isKnownPreset(name: string): boolean {
  return name in MCP_PRESETS;
}

export function validateMcpPresets(names: string[]): string | null {
  const unknown = names.filter(n => !isKnownPreset(n));
  if (unknown.length > 0) {
    return `Unknown MCP preset(s): ${unknown.join(', ')}. Available: ${getPresetNames().join(', ')}`;
  }
  return null;
}

/**
 * Build an MCP config JSON object from preset names.
 * Output format matches claude CLI's --mcp-config expectation.
 */
export function buildMcpConfig(presets: string[]): {
  mcpServers: Record<string, McpServerEntry>;
} {
  const servers: Record<string, McpServerEntry> = {};
  for (const name of presets) {
    const preset = MCP_PRESETS[name];
    if (!preset) {
      throw new Error(`Unknown MCP preset: ${name}`);
    }
    servers[name] = preset;
  }
  return { mcpServers: servers };
}
