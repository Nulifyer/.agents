#!/usr/bin/env bun
import { main } from "../shape.ts";
await main([...process.argv.slice(2), "--adapter", "data"]);
