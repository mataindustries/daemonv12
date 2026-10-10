#!/usr/bin/env node
import { launch } from './launch.js';

await launch('daemonv12-mcp', 'mcp/main', 2);
